//! One receive worker, one replaceable pending request; UI IDs never serve as IMAP UIDs.
use super::{Folder, Page, Reference};
use crate::accounts;
use made_mail_core::{Account, Mailbox, Message, MessageKey};
use std::{collections::HashMap, sync::mpsc};
#[derive(Clone)]
enum Request {
    Page {
        account: String,
        folder: String,
        list: bool,
    },
    Body {
        key: MessageKey,
        reference: Reference,
    },
}
impl Request {
    fn account(&self) -> &str {
        match self {
            Self::Page { account, .. } => account,
            Self::Body { key, .. } => &key.account,
        }
    }
}
enum Answer {
    Page(Page),
    Body(String),
}
struct Pending {
    generation: u64,
    request: Request,
    receiver: mpsc::Receiver<Result<Answer, &'static str>>,
}
#[derive(Default)]
pub struct Receiving {
    pub folders: HashMap<String, Vec<Folder>>,
    references: HashMap<MessageKey, Reference>,
    labels: HashMap<String, String>,
    worker: Option<Pending>,
    queued: Option<Request>,
    generation: u64,
    next_id: u64,
}
impl Receiving {
    pub fn load_account(&mut self, id: String, label: String) {
        self.labels.insert(id.clone(), label);
        self.enqueue(Request::Page {
            account: id,
            folder: "INBOX".into(),
            list: true,
        });
    }
    pub fn folder(&mut self, account: &str, path: &str) {
        if self.labels.contains_key(account) {
            self.enqueue(Request::Page {
                account: account.into(),
                folder: path.into(),
                list: false,
            });
        }
    }
    pub fn open(&mut self, key: &MessageKey) {
        if let Some(reference) = self.references.get(key) {
            self.enqueue(Request::Body {
                key: key.clone(),
                reference: reference.clone(),
            });
        }
    }
    pub fn refresh(&mut self, scope: &made_mail_core::Scope) {
        match scope {
            made_mail_core::Scope::Inbox(account) => self.folder(account, "INBOX"),
            made_mail_core::Scope::Folder { account, path } => self.folder(account, path),
            made_mail_core::Scope::AllInboxes => {}
        }
    }
    pub fn is_remote(&self, key: &MessageKey) -> bool {
        self.references.contains_key(key)
    }
    pub fn remove(&mut self, id: &str, mailbox: &mut Mailbox) {
        self.labels.remove(id);
        self.folders.remove(id);
        self.references.retain(|k, _| k.account != id);
        mailbox.accounts.retain(|a| a.id != id);
        mailbox.messages.retain(|m| m.key.account != id);
        if self.queued.as_ref().is_some_and(|r| r.account() == id) {
            self.queued = None;
        }
        // An already authenticated request may finish, but cannot repopulate the removed account.
        self.generation += 1;
    }
    fn enqueue(&mut self, request: Request) {
        self.generation += 1;
        self.queued = Some(request);
    }
    pub fn poll(
        &mut self,
        mailbox: &mut Mailbox,
        status: &mut String,
        ctx: &eframe::egui::Context,
    ) {
        if let Some(worker) = &self.worker {
            let result = match worker.receiver.try_recv() {
                Ok(result) => Some(result),
                Err(mpsc::TryRecvError::Disconnected) => {
                    Some(Err("Receiving stopped. Refresh to try again."))
                }
                Err(mpsc::TryRecvError::Empty) => None,
            };
            if let Some(result) = result {
                let Some(worker) = self.worker.take() else {
                    return;
                };
                if worker.generation == self.generation
                    && self.labels.contains_key(worker.request.account())
                {
                    match result.and_then(|answer|self.apply(&worker.request,answer,mailbox)) {
                        Ok(())=>*status="Read-only mail loaded · newest 50 messages per folder · server flags unchanged".into(),
                        Err(error)=>*status=error.into(),
                    }
                }
            }
        }
        if self.worker.is_none()
            && let Some(request) = self.queued.take()
        {
            let (tx, receiver) = mpsc::channel();
            let task = request.clone();
            let ctx = ctx.clone();
            self.worker = Some(Pending {
                generation: self.generation,
                request,
                receiver,
            });
            *status = "Loading mail securely…".into();
            std::thread::spawn(move || {
                // Release the credential-store lock before network I/O; only this account is loaded.
                let settings = accounts::OsStore::open()
                    .and_then(|store| accounts::load(&store, task.account()));
                let result = settings.and_then(|settings| match &task {
                    Request::Page { folder, list, .. } => {
                        super::page(&settings, folder, *list).map(Answer::Page)
                    }
                    Request::Body { reference, .. } => {
                        super::body(&settings, reference).map(Answer::Body)
                    }
                });
                let _ = tx.send(result);
                ctx.request_repaint();
            });
        }
    }
    fn apply(
        &mut self,
        request: &Request,
        answer: Answer,
        mailbox: &mut Mailbox,
    ) -> Result<(), &'static str> {
        match (request, answer) {
            (
                Request::Page {
                    account, folder, ..
                },
                Answer::Page(page),
            ) => {
                // Keep each Inbox plus at most one additional folder per account in memory.
                let keep = |key: &MessageKey, path: &str| {
                    key.account != *account
                        || (path.eq_ignore_ascii_case("INBOX")
                            && !folder.eq_ignore_ascii_case("INBOX"))
                };
                mailbox.messages.retain(|m| keep(&m.key, &m.folder));
                self.references.retain(|key, r| keep(key, &r.folder));
                if !mailbox.accounts.iter().any(|a| a.id == *account) {
                    mailbox.accounts.push(Account {
                        id: account.clone(),
                        label: self.labels.get(account).cloned().unwrap_or_default(),
                    });
                }
                if let Some(folders) = page.folders {
                    self.folders.insert(account.clone(), folders);
                }
                for header in page.headers {
                    self.next_id = self
                        .next_id
                        .checked_add(1)
                        .ok_or("Session message limit reached. Restart the evaluation.")?;
                    let key = MessageKey {
                        account: account.clone(),
                        id: self.next_id,
                    };
                    self.references.insert(key.clone(), header.reference);
                    mailbox.messages.push(Message{key,sender:header.sender,subject:header.subject,body:"Select this message to load its text. Messages larger than 1 MiB cannot be opened in this evaluation.".into(),folder:folder.clone(),unread:header.unread});
                }
            }
            (Request::Body { key, reference }, Answer::Body(body)) => {
                if self.references.get(key) != Some(reference) {
                    return Err("Folder changed. Select the message again.");
                }
                // Bound body cache to one selected message; previously viewed messages can be reloaded.
                for message in &mut mailbox.messages {
                    if &message.key == key {
                        message.body = body.clone();
                    } else {
                        message.body = "Select this message to load its text.".into();
                    }
                }
            }
            _ => return Err("Unexpected receiving result."),
        }
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn page(folder: &str) -> Page {
        Page {
            folders: None,
            headers: vec![super::super::Header {
                reference: Reference {
                    folder: folder.into(),
                    validity: 1,
                    uid: 1,
                    size: 12,
                },
                sender: "Fixture".into(),
                subject: folder.into(),
                unread: true,
            }],
        }
    }
    #[test]
    fn same_uid_in_two_folders_never_reuses_ui_identity() {
        let mut state = Receiving::default();
        state.labels.insert("a".into(), "a@example.invalid".into());
        let mut mail = Mailbox {
            accounts: vec![],
            messages: vec![],
        };
        for folder in ["INBOX", "Archive"] {
            let request = Request::Page {
                account: "a".into(),
                folder: folder.into(),
                list: false,
            };
            state
                .apply(&request, Answer::Page(page(folder)), &mut mail)
                .unwrap_or_else(|e| panic!("{e}"));
        }
        assert_eq!(mail.messages.len(), 2);
        assert_ne!(mail.messages[0].key, mail.messages[1].key);
        let old = mail.messages[1].key.clone();
        let reference = state.references[&old].clone();
        state
            .apply(
                &Request::Page {
                    account: "a".into(),
                    folder: "Other".into(),
                    list: false,
                },
                Answer::Page(page("Other")),
                &mut mail,
            )
            .unwrap_or_else(|e| panic!("{e}"));
        assert!(
            state
                .apply(
                    &Request::Body {
                        key: old,
                        reference
                    },
                    Answer::Body("stale".into()),
                    &mut mail
                )
                .is_err()
        );
        assert!(!mail.messages.iter().any(|m| m.body == "stale"));
    }
    #[test]
    fn pending_selection_is_replaced_and_removal_clears_data() {
        let mut state = Receiving::default();
        let mut mail = Mailbox::sample();
        state.load_account("sample-a".into(), "fixture".into());
        state.folder("sample-a", "Archive");
        assert!(matches!(state.queued,Some(Request::Page{ref folder,..})if folder=="Archive"));
        state.remove("sample-a", &mut mail);
        assert!(state.queued.is_none());
        assert!(mail.messages.iter().all(|m| m.key.account != "sample-a"));
    }
    #[test]
    fn obsolete_worker_reply_cannot_populate_the_mailbox() {
        let mut state = Receiving::default();
        state.labels.insert("a".into(), "fixture".into());
        let (tx, receiver) = mpsc::channel();
        state.worker = Some(Pending {
            generation: 0,
            request: Request::Page {
                account: "a".into(),
                folder: "INBOX".into(),
                list: true,
            },
            receiver,
        });
        state.generation = 1;
        assert!(tx.send(Ok(Answer::Page(page("INBOX")))).is_ok());
        let mut mail = Mailbox {
            accounts: vec![],
            messages: vec![],
        };
        let mut status = String::new();
        state.poll(&mut mail, &mut status, &eframe::egui::Context::default());
        assert!(mail.messages.is_empty());
        assert!(state.worker.is_none());
    }
}

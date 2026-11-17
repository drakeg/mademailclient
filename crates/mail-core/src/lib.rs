//! UI-independent mailbox state. No network, credential access or persistence.
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unified_inbox_keeps_account_identity_and_excludes_other_folders() {
        let state = Mailbox::sample();
        assert_eq!(state.visible(&Scope::AllInboxes).len(), 2);
        assert_eq!(state.visible(&Scope::Inbox("sample-a".into())).len(), 1);
        assert_eq!(state.visible(&Scope::Inbox("missing".into())).len(), 0);
    }
    #[test]
    fn opening_marks_only_the_selected_account_message_read() {
        let mut state = Mailbox::sample();
        let key = MessageKey {
            account: "sample-a".into(),
            id: 1,
        };
        assert!(state.open(&key).is_some());
        assert!(!state.messages[0].unread);
        assert!(state.messages[1].unread);
        assert!(
            state
                .open(&MessageKey {
                    account: "missing".into(),
                    id: 1
                })
                .is_none()
        );
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct MessageKey {
    pub account: String,
    pub id: u64,
}
#[derive(Clone, Debug)]
pub struct Message {
    pub key: MessageKey,
    pub sender: String,
    pub subject: String,
    pub body: String,
    pub folder: String,
    pub unread: bool,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Scope {
    AllInboxes,
    Inbox(String),
    Folder { account: String, path: String },
}
pub struct Account {
    pub id: String,
    pub label: String,
}
pub struct Mailbox {
    pub accounts: Vec<Account>,
    pub messages: Vec<Message>,
}
impl Mailbox {
    pub fn visible(&self, scope: &Scope) -> Vec<&Message> {
        self.messages
            .iter()
            .filter(|m| match scope {
                Scope::AllInboxes => m.folder.eq_ignore_ascii_case("INBOX"),
                Scope::Inbox(id) => &m.key.account == id && m.folder.eq_ignore_ascii_case("INBOX"),
                Scope::Folder { account, path } => &m.key.account == account && &m.folder == path,
            })
            .collect()
    }
    pub fn open(&mut self, key: &MessageKey) -> Option<&Message> {
        let message = self.messages.iter_mut().find(|m| &m.key == key)?;
        message.unread = false;
        Some(message)
    }
    pub fn sample() -> Self {
        Self {
            accounts: vec![
                Account { id: "sample-a".into(), label: "alex@example.invalid".into() },
                Account { id: "sample-b".into(), label: "sam@example.invalid".into() },
            ],
            messages: vec![
                Message { key: MessageKey { account: "sample-a".into(), id: 1 }, sender: "Morgan".into(), subject: "Welcome to Made Mail".into(), body: "This is the original Rust desktop foundation for Made Mail.\n\nThis window uses fictional mail only. Your existing accounts and messages have not been opened.\n\nChoose an account’s Inbox or All Inboxes on the left.".into(), folder: "INBOX".into(), unread: true },
                Message { key: MessageKey { account: "sample-b".into(), id: 1 }, sender: "Jamie".into(), subject: "One inbox, multiple accounts".into(), body: "Both sample accounts appear in All Inboxes. Individual account folders remain available.\n\nThis fictional sample does not use a network connection. Read-only receiving is available separately through Accounts; sending and deletion are not yet connected.".into(), folder: "INBOX".into(), unread: true },
                Message { key: MessageKey { account: "sample-a".into(), id: 2 }, sender: "Alex".into(), subject: "Sent fixture".into(), body: "Not an Inbox message.".into(), folder: "Sent".into(), unread: false },
            ],
        }
    }
}

#[cfg(test)]
mod folder_tests {
    use super::*;
    #[test]
    fn folder_scope_does_not_mix_accounts_or_inboxes() {
        let mut mailbox = Mailbox::sample();
        mailbox.messages[0].folder = "inbox".into();
        assert_eq!(mailbox.visible(&Scope::AllInboxes).len(), 2);
        assert_eq!(
            mailbox
                .visible(&Scope::Folder {
                    account: "sample-a".into(),
                    path: "Sent".into()
                })
                .len(),
            1
        );
        assert!(
            mailbox
                .visible(&Scope::Folder {
                    account: "sample-b".into(),
                    path: "Sent".into()
                })
                .is_empty()
        );
    }
}

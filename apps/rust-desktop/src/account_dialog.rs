use crate::accounts::{self, SavedAccount, SecretStore, Security, Settings};
use eframe::egui;
use std::sync::{Arc, Mutex, mpsc};
use zeroize::Zeroizing;

struct Outcome {
    saved: Vec<SavedAccount>,
    notice: Option<String>,
    checked: Option<(String, bool)>,
}
type Reply = Result<Outcome, &'static str>;
type Fixture = Arc<Mutex<std::collections::HashMap<String, Vec<u8>>>>;
enum Operation {
    Load,
    Add(Settings),
    Remove(String),
    Verify(String),
}
struct SessionStore(Fixture);
impl SecretStore for SessionStore {
    fn read(&self, key: &str) -> Result<Option<Zeroizing<Vec<u8>>>, &'static str> {
        Ok(self
            .0
            .lock()
            .map_err(|_| "Test store unavailable")?
            .get(key)
            .cloned()
            .map(Zeroizing::new))
    }
    fn write(&self, key: &str, value: &[u8]) -> Result<(), &'static str> {
        self.0
            .lock()
            .map_err(|_| "Test store unavailable")?
            .insert(key.into(), value.into());
        Ok(())
    }
    fn remove(&self, key: &str) -> Result<(), &'static str> {
        self.0
            .lock()
            .map_err(|_| "Test store unavailable")?
            .remove(key);
        Ok(())
    }
}
fn run(store: &dyn SecretStore, operation: Operation) -> Reply {
    let saved = match operation {
        Operation::Load => accounts::list(store),
        Operation::Add(settings) => accounts::add(store, settings),
        Operation::Remove(id) => accounts::remove(store, &id),
        Operation::Verify(id) => {
            let settings = accounts::load(store, &id)?;
            let result = crate::verify::verify(&settings);
            let checked = result.imap.is_ok() && result.smtp.is_ok();
            let describe = |result: Result<(), &'static str>| {
                result.err().unwrap_or("authentication succeeded")
            };
            return Ok(Outcome {
                saved: accounts::list(store)?,
                notice: Some(format!(
                    "IMAP: {}\nSMTP: {}\nNo mailbox was read and no email was submitted. These results apply to this test, not a persistent connection.",
                    describe(result.imap),
                    describe(result.smtp)
                )),
                checked: Some((id, checked)),
            });
        }
    }?;
    Ok(Outcome {
        saved,
        notice: None,
        checked: None,
    })
}
pub struct AccountDialog {
    open: bool,
    form: Settings,
    saved: Vec<SavedAccount>,
    pending: Option<mpsc::Receiver<Reply>>,
    status: String,
    remove: Option<String>,
    verify: Option<(String, String)>,
    checked: std::collections::HashMap<String, bool>,
    fixture: Option<Fixture>,
}
impl AccountDialog {
    pub fn new(fixture: bool) -> Self {
        Self {
            open: false,
            form: Self::blank(),
            saved: vec![],
            pending: None,
            status: String::new(),
            remove: None,
            verify: None,
            checked: Default::default(),
            fixture: fixture.then(|| Arc::new(Mutex::new(Default::default()))),
        }
    }
    fn blank() -> Settings {
        let mut settings = Settings::default();
        settings.imap_port = 993;
        settings.smtp_port = 465;
        settings
    }
    pub fn is_open(&self) -> bool {
        self.open
    }
    pub fn open(&mut self, ctx: &egui::Context) {
        self.open = true;
        if self.pending.is_none() {
            self.start(Operation::Load, ctx);
        }
    }
    fn start(&mut self, operation: Operation, ctx: &egui::Context) {
        if self.pending.is_some() {
            return;
        }
        if self.fixture.is_some() && matches!(operation, Operation::Verify(_)) {
            self.status = "Network verification is disabled in temporary fixture mode.".into();
            return;
        }
        let (tx, rx) = mpsc::channel();
        self.pending = Some(rx);
        self.status = "Working with saved account settings…".into();
        let fixture = self.fixture.clone();
        let ctx = ctx.clone();
        std::thread::spawn(move || {
            let result = if let Some(memory) = fixture {
                run(&SessionStore(memory), operation)
            } else {
                accounts::OsStore::open().and_then(|store| run(&store, operation))
            };
            let _ = tx.send(result);
            ctx.request_repaint();
        });
    }
    pub fn show(&mut self, ctx: &egui::Context) {
        if let Some(receiver) = &self.pending {
            match receiver.try_recv() {
                Ok(result) => {
                    self.pending = None;
                    match result {
                        Ok(outcome) => {
                            self.saved = outcome.saved;
                            self.checked
                                .retain(|id, _| self.saved.iter().any(|a| &a.id == id));
                            if let Some((id, checked)) = outcome.checked {
                                self.checked.insert(id, checked);
                            }
                            self.status=outcome.notice.unwrap_or_else(||"Saved settings only — use Verify sign-in to check authentication.".into());
                        }
                        Err(error) => self.status = error.into(),
                    }
                }
                Err(mpsc::TryRecvError::Disconnected) => {
                    self.pending = None;
                    self.status =
                        "Account operation stopped. Reload settings before trying again.".into();
                }
                Err(mpsc::TryRecvError::Empty) => {}
            }
        }
        if !self.open {
            return;
        }
        let busy = self.pending.is_some();
        let mut open = true;
        let mut window = egui::Window::new("Accounts")
            .id(egui::Id::unique("accounts-dialog"))
            .default_width(540.0)
            .resizable(true)
            .vscroll(true)
            .default_height(620.0);
        if !busy {
            window = window.open(&mut open);
        }
        window.show(ctx, |ui| {
            ui.label("Rust account settings · not yet connected to mail");
            if self.fixture.is_some() {
                ui.colored_label(egui::Color32::DARK_RED, "TEST SESSION — temporary memory only; OS credentials are not accessed.");
            } else {
                ui.label("Passwords are saved through the OS credential store. Existing Electron accounts are not imported or changed.");
            }
            ui.separator();
            ui.heading("Saved settings");
            let mut remove = None;
            let mut verify = None;
            if self.saved.is_empty() { ui.label("No saved settings loaded."); }
            for account in &self.saved {
                ui.horizontal(|ui| {
                    ui.label(&account.label);
                    ui.label(if account.incomplete { "Incomplete" } else if self.checked.get(&account.id)==Some(&true) { "Authentication checked this session" } else { "Unverified" });
                    if ui.add_enabled(!busy&&!account.incomplete,egui::Button::new(if self.fixture.is_some(){"Preview sign-in test…"}else{"Test IMAP and SMTP…"})).clicked() { verify=Some((account.id.clone(),format!("{}\n{}",account.label,account.endpoints))); }
                    if ui.add_enabled(!busy, egui::Button::new("Remove…")).clicked() { remove = Some(account.id.clone()); }
                });
            }
            if let Some(id) = remove { self.remove = Some(id); }
            if let Some(target)=verify { self.verify=Some(target); }
            if let Some((id,details))=self.verify.clone() {
                ui.group(|ui| {
                    ui.label(details);
                    if self.fixture.is_some(){ui.label("TEST SESSION: this confirmation is preview-only; no network verification can run.");}
                    ui.label("Send the saved credentials to these servers after trusted TLS verification? This checks authentication only: no messages will be read or sent.");
                    ui.horizontal(|ui| {
                        if ui.add_enabled(!busy,egui::Button::new("Cancel test")).clicked() { self.verify=None; }
                        if ui.add_enabled(!busy&&self.fixture.is_none(),egui::Button::new("Verify sign-in")).clicked() { self.verify=None;self.start(Operation::Verify(id),ctx); }
                    });
                });
            }
            if let Some(id) = self.remove.clone() {
                ui.group(|ui| {
                    ui.label("Remove these saved settings and passwords? Remote messages will not be changed.");
                    ui.horizontal(|ui| {
                        if ui.add_enabled(!busy, egui::Button::new("Cancel removal")).clicked() { self.remove = None; }
                        if ui.add_enabled(!busy, egui::Button::new("Remove saved settings")).clicked() {
                            self.remove = None;
                            self.start(Operation::Remove(id), ctx);
                        }
                    });
                });
            }
            if ui.add_enabled(!busy, egui::Button::new("Reload settings")).clicked() { self.start(Operation::Load, ctx); }
            ui.separator();
            ui.heading("Add account settings");
            ui.add_enabled_ui(!busy, |ui| {
                egui::Grid::new("account-email").num_columns(2).show(ui, |ui| {
                    let label = ui.label("Email address");
                    ui.text_edit_singleline(&mut self.form.email).labelled_by(label.id);
                    ui.end_row();
                });
                Self::endpoint(ui, "Incoming · IMAP", &mut self.form.imap_host, &mut self.form.imap_port, &mut self.form.imap_security, &mut self.form.imap_user, &mut self.form.imap_password);
                Self::endpoint(ui, "Outgoing · SMTP", &mut self.form.smtp_host, &mut self.form.smtp_port, &mut self.form.smtp_security, &mut self.form.smtp_user, &mut self.form.smtp_password);
                ui.label("Use an app password if required. Browser sign-in and discovery are not implemented. Save settings, then Test IMAP and SMTP to check authentication.");
                let save_label = if self.fixture.is_some() { "Save for this test session" } else { "Save settings securely" };
                if ui.button(save_label).clicked() {
                    if let Err(error) = self.form.validate() { self.status = error.into(); }
                    else {
                        let settings = std::mem::replace(&mut self.form, Self::blank());
                        self.start(Operation::Add(settings), ctx);
                    }
                }
            });
            ui.separator();
            ui.label(&self.status);
            if ui.add_enabled(!busy, egui::Button::new("Close")).clicked() { self.open = false; }
        });
        if !open {
            self.open = false;
        }
        if !self.open {
            self.form = Self::blank();
            self.remove = None;
            self.verify = None;
        }
    }
    #[allow(clippy::too_many_arguments)]
    fn endpoint(
        ui: &mut egui::Ui,
        title: &str,
        host: &mut String,
        port: &mut u16,
        security: &mut Security,
        user: &mut String,
        password: &mut String,
    ) {
        ui.push_id(title, |ui| {
            ui.strong(title);
            egui::Grid::new("endpoint").num_columns(2).show(ui, |ui| {
                let label = ui.label("Server hostname");
                ui.text_edit_singleline(host).labelled_by(label.id);
                ui.end_row();
                let label = ui.label("Port");
                ui.add(egui::DragValue::new(port).range(1..=65535))
                    .labelled_by(label.id);
                ui.end_row();
                ui.label("Security");
                ui.horizontal(|ui| {
                    ui.radio_value(security, Security::Tls, "TLS");
                    ui.radio_value(security, Security::StartTls, "STARTTLS");
                });
                ui.end_row();
                let label = ui.label("Username");
                ui.text_edit_singleline(user).labelled_by(label.id);
                ui.end_row();
                let label = ui.label("Password / app password");
                ui.add(egui::TextEdit::singleline(password).password(true))
                    .labelled_by(label.id);
                ui.end_row();
            });
        });
    }
}

#[cfg(test)]
mod verification_tests {
    use super::*;
    #[test]
    fn temporary_fixture_mode_cannot_start_network_verification() {
        let mut dialog = AccountDialog::new(true);
        dialog.start(
            Operation::Verify(uuid::Uuid::new_v4().to_string()),
            &egui::Context::default(),
        );
        assert!(dialog.pending.is_none());
        assert!(dialog.status.contains("disabled"));
    }
}

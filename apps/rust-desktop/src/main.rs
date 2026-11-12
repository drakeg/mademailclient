//! Offline toolkit evaluation. Never opens the Electron profile or connects to a provider.
mod menus;
use eframe::egui;
use made_mail_core::{Mailbox, MessageKey, Scope};

struct MadeMail {
    mailbox: Mailbox,
    scope: Scope,
    selected: Option<MessageKey>,
    status: String,
    _menus: menus::NativeMenus,
}
impl MadeMail {
    fn new(
        cc: &eframe::CreationContext<'_>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(Self {
            mailbox: Mailbox::sample(),
            scope: Scope::AllInboxes,
            selected: None,
            status: "Rust desktop evaluation · fictional mail · no connected accounts".into(),
            _menus: menus::NativeMenus::install(cc)?,
        })
    }
}
impl eframe::App for MadeMail {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();
        if let Some(command) = menus::next_command() {
            match command.as_str() {
                "all-inboxes" => { self.scope = Scope::AllInboxes; self.selected = None; },
                "accounts" => self.status = "Account setup is the next migration stage. This evaluation never opens your saved profile.".into(),
                "about" => self.status = "Made Mail · original Rust desktop evaluation · no Electron or webview".into(),
                _ => {},
            }
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        egui::Panel::top("menu").show(ui, |ui| {
            egui::MenuBar::new().ui(ui, |ui| {
                ui.menu_button("File", |ui| {
                    if ui.button("Accounts…").clicked() {
                        self.status = "Account setup is not connected in this evaluation.".into();
                    }
                });
                ui.menu_button("View", |ui| {
                    if ui.button("All Inboxes").clicked() {
                        self.scope = Scope::AllInboxes;
                        self.selected = None;
                    }
                });
            });
        });
        egui::Panel::bottom("status").show(ui, |ui| {
            ui.label(&self.status);
        });
        egui::Panel::top("toolbar").show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.heading("Made Mail");
                ui.separator();
                ui.label("Native desktop foundation");
            });
        });
        egui::Panel::left("folders")
            .default_size(220.0)
            .resizable(true)
            .show(ui, |ui| {
                ui.add_space(12.0);
                if ui
                    .selectable_label(self.scope == Scope::AllInboxes, "All Inboxes")
                    .clicked()
                {
                    self.scope = Scope::AllInboxes;
                    self.selected = None;
                }
                ui.separator();
                for account in &self.mailbox.accounts {
                    ui.label(&account.label);
                    let scope = Scope::Inbox(account.id.clone());
                    if ui
                        .selectable_label(self.scope == scope, "    Inbox")
                        .clicked()
                    {
                        self.scope = scope;
                        self.selected = None;
                    }
                    ui.add_space(10.0);
                }
            });
        let mut opened = None;
        egui::Panel::left("messages")
            .default_size(320.0)
            .resizable(true)
            .show(ui, |ui| {
                ui.heading("Inbox");
                ui.separator();
                egui::ScrollArea::vertical().show(ui, |ui| {
                    for message in self.mailbox.visible(&self.scope) {
                        let title = format!(
                            "{}{}\n{}",
                            if message.unread { "● " } else { "" },
                            message.sender,
                            message.subject
                        );
                        if ui
                            .selectable_label(self.selected.as_ref() == Some(&message.key), title)
                            .clicked()
                        {
                            opened = Some(message.key.clone());
                        }
                        ui.separator();
                    }
                });
            });
        if let Some(key) = opened {
            self.mailbox.open(&key);
            self.selected = Some(key);
        }
        egui::CentralPanel::default().show(ui, |ui| {
            ui.add_space(14.0);
            if let Some(message) = self
                .mailbox
                .messages
                .iter()
                .find(|m| Some(&m.key) == self.selected.as_ref())
            {
                ui.heading(&message.subject);
                ui.label(format!("From: {}", message.sender));
                ui.separator();
                ui.horizontal(|ui| {
                    for label in ["Reply", "Reply All", "Forward", "Junk", "Delete"] {
                        ui.add_enabled(false, egui::Button::new(label))
                            .on_disabled_hover_text(
                                "Provider operations are not connected in this evaluation.",
                            );
                    }
                });
                ui.separator();
                egui::ScrollArea::vertical().show(ui, |ui| {
                    ui.add(egui::Label::new(&message.body).selectable(true));
                });
            } else {
                ui.heading("Choose a message");
                ui.label("Select fictional mail from either Inbox or All Inboxes.");
            }
        });
        // Native menu clicks need servicing even when the window is otherwise idle.
        ctx.request_repaint_after(std::time::Duration::from_millis(100));
    }
}
fn main() -> eframe::Result {
    eframe::run_native(
        "Made Mail — Rust Evaluation",
        eframe::NativeOptions {
            viewport: egui::ViewportBuilder::default()
                .with_inner_size([1200.0, 760.0])
                .with_min_inner_size([800.0, 540.0]),
            ..Default::default()
        },
        Box::new(|cc| Ok(Box::new(MadeMail::new(cc)?))),
    )
}

mod account_dialog;
// Rust desktop evaluation. Never opens the Electron profile or connects to a provider.
mod menus;
use eframe::egui;
use made_mail_core::{Mailbox, MessageKey, Scope};

struct MadeMail {
    mailbox: Mailbox,
    accounts: account_dialog::AccountDialog,
    scope: Scope,
    selected: Option<MessageKey>,
    status: String,
    _menus: menus::NativeMenus,
    folders: Vec<egui::Id>,
    rows: Vec<(egui::Id, MessageKey)>,
    reader: egui::Id,
    scroll_to: Option<MessageKey>,
}
impl MadeMail {
    fn new(
        cc: &eframe::CreationContext<'_>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(Self {
            mailbox: Mailbox::sample(),
            accounts: account_dialog::AccountDialog::new(
                std::env::args().any(|arg| arg == "--account-fixture"),
            ),
            scope: Scope::AllInboxes,
            selected: None,
            status: "Rust desktop evaluation · fictional mail · no connected accounts".into(),
            _menus: menus::NativeMenus::install(cc)?,
            folders: Vec::new(),
            rows: Vec::new(),
            reader: egui::Id::unique("reader-text"),
            scroll_to: None,
        })
    }
    fn keyboard(&mut self, ctx: &egui::Context) {
        let focus = ctx.memory(|memory| memory.focused());
        let reverse =
            ctx.input_mut(|input| input.consume_key(egui::Modifiers::SHIFT, egui::Key::F6));
        let forward =
            ctx.input_mut(|input| input.consume_key(egui::Modifiers::NONE, egui::Key::F6));
        if reverse || forward {
            let mut panes = vec![];
            if let Some(id) = self.folders.first() {
                panes.push(*id);
            }
            if let Some((id, _)) = self
                .rows
                .iter()
                .find(|(_, key)| Some(key) == self.selected.as_ref())
                .or(self.rows.first())
            {
                panes.push(*id);
            }
            if self.selected.is_some() {
                panes.push(self.reader);
            }
            if !panes.is_empty() {
                let current = if focus == Some(self.reader) {
                    panes.len() - 1
                } else if self.rows.iter().any(|(id, _)| Some(*id) == focus) {
                    1
                } else {
                    0
                };
                let next = if reverse {
                    (current + panes.len() - 1) % panes.len()
                } else {
                    (current + 1) % panes.len()
                };
                ctx.memory_mut(|memory| memory.request_focus(panes[next]));
            }
            return;
        }
        let Some((_, current)) = self.rows.iter().find(|(id, _)| Some(*id) == focus) else {
            return;
        };
        let step = ctx.input_mut(|input| {
            use navigation::Step;
            [
                (egui::Key::ArrowUp, Step::Previous),
                (egui::Key::ArrowDown, Step::Next),
                (egui::Key::Home, Step::First),
                (egui::Key::End, Step::Last),
            ]
            .into_iter()
            .find_map(|(key, step)| {
                input
                    .consume_key(egui::Modifiers::NONE, key)
                    .then_some(step)
            })
        });
        if let Some(step) = step {
            let keys = self
                .mailbox
                .visible(&self.scope)
                .iter()
                .map(|m| m.key.clone())
                .collect::<Vec<_>>();
            if let Some(key) = navigation::destination(&keys, current, step) {
                if let Some((id, _)) = self.rows.iter().find(|(_, k)| k == &key) {
                    ctx.memory_mut(|memory| memory.request_focus(*id));
                }
                self.scroll_to = Some(key.clone());
                self.mailbox.open(&key);
                self.selected = Some(key);
            }
        }
    }
}
impl eframe::App for MadeMail {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();
        while let Some(command) = menus::next_command() {
            match command.as_str() {
                "all-inboxes" => {
                    self.scope = Scope::AllInboxes;
                    self.selected = None;
                }
                "copy" => ctx.input_mut(|input| input.events.push(egui::Event::Copy)),
                "select-all" => ctx.input_mut(|input| {
                    input.events.push(egui::Event::Key {
                        key: egui::Key::A,
                        physical_key: None,
                        pressed: true,
                        repeat: false,
                        modifiers: egui::Modifiers {
                            command: true,
                            mac_cmd: cfg!(target_os = "macos"),
                            ctrl: cfg!(not(target_os = "macos")),
                            ..Default::default()
                        },
                    })
                }),
                "accounts" => self.accounts.open(&ctx),
                "about" => {
                    self.status =
                        "Made Mail · original Rust desktop evaluation · no Electron or webview"
                            .into()
                }
                _ => {}
            }
        }
        self.accounts.show(&ctx);
        if !self.accounts.is_open() {
            self.keyboard(&ctx);
        }
        self.folders.clear();
        self.rows.clear();
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        egui::Panel::top("menu").show(ui, |ui| {
            egui::MenuBar::new().ui(ui, |ui| {
                ui.menu_button("File", |ui| {
                    if ui.button("Accounts…").clicked() {
                        self.accounts.open(&ctx);
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
                let all = ui.selectable_label(self.scope == Scope::AllInboxes, "All Inboxes");
                self.folders.push(all.id);
                if all.clicked() {
                    self.scope = Scope::AllInboxes;
                    self.selected = None;
                }
                ui.separator();
                for account in &self.mailbox.accounts {
                    ui.label(&account.label);
                    let scope = Scope::Inbox(account.id.clone());
                    let inbox = ui.selectable_label(
                        self.scope == scope,
                        format!("Inbox — {}", account.label),
                    );
                    self.folders.push(inbox.id);
                    if inbox.clicked() {
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
                            if message.unread { "Unread · " } else { "" },
                            message.sender,
                            message.subject
                        );
                        let row = ui
                            .push_id((&message.key.account, message.key.id), |ui| {
                                ui.selectable_label(
                                    self.selected.as_ref() == Some(&message.key),
                                    title,
                                )
                            })
                            .inner;
                        self.rows.push((row.id, message.key.clone()));
                        if row.has_focus() {
                            ui.memory_mut(|memory| {
                                memory.set_focus_lock_filter(
                                    row.id,
                                    egui::EventFilter {
                                        vertical_arrows: true,
                                        ..Default::default()
                                    },
                                )
                            });
                        }
                        if self.scroll_to.as_ref() == Some(&message.key) {
                            row.scroll_to_me(Some(egui::Align::Center));
                        }
                        if row.clicked() {
                            row.request_focus();
                            ui.memory_mut(|memory| {
                                memory.set_focus_lock_filter(
                                    row.id,
                                    egui::EventFilter {
                                        vertical_arrows: true,
                                        ..Default::default()
                                    },
                                )
                            });
                            opened = Some(message.key.clone());
                        }
                        ui.separator();
                    }
                });
            });
        self.scroll_to = None;
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
                self.reader =
                    egui::Id::unique(("reader-text", &message.key.account, message.key.id));
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
                    let mut body = message.body.as_str();
                    ui.add(
                        egui::TextEdit::multiline(&mut body)
                            .id(self.reader)
                            .desired_width(f32::INFINITY)
                            .desired_rows(20)
                            .frame(egui::Frame::NONE),
                    );
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

mod navigation;

mod accounts;

mod verify;

mod provider_presets;

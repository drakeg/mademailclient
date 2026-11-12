# Active migration tasks

- [x] Record owner direction, scope, migration order and acceptance gates.
- [x] N01: implement and test Rust mailbox model and offline desktop shell.
- [x] N01: validate Mac window, sample selection/read marking, per-account Inbox and native View → All Inboxes.
- [ ] N01: build Mac/Windows/Linux in CI; native Windows/Linux runtime acceptance still pending.
- [ ] N02: accept/reject toolkit after keyboard, accessibility, text editing and OS behavior checks.
- [ ] N03–N07: implement in ordered, reviewed PRs; do not retire Electron prematurely.

PR health: #13 and #16 were conflict-free at inspection; CI passed and installer jobs queued. Verify final runs before reporting them complete.

N02 keyboard/text slice: implement scoped arrow/Home/End message navigation, F6 pane cycling, explicit row focus on click, account-labelled Inbox controls and read-only selectable reader. Route native Copy/Select All to focused egui controls. Tests cover duplicate numeric IDs across accounts, scope removal, empty lists and navigation boundaries. Full accessibility/IME and Windows/Linux manual acceptance are not marked complete.

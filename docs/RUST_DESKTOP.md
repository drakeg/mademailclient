# Rust desktop evaluation

Made Mail is moving toward a Rust desktop runtime without Electron or a webview. This branch starts an independent, original evaluation; **it is not yet a usable replacement email client**. No Mailcraft source or assets are used.

The executable opens only invented mail: All Inboxes, two account Inboxes and a selectable reading pane. Opening a message marks that account's message read. Mac/Windows native menus expose account setup information and All Inboxes; mail-changing menu items are disabled. OS window decorations remain enabled. Linux has an in-window menu. There is no network, credential access, persistence or access to the current application's profile.

## Development

Use Rust 1.99.1, with rustfmt and clippy. From the repository root:

```sh
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo run -p made-mail-native --locked
```

Linux development needs the system X11/Wayland/OpenGL build packages listed in `.github/workflows/rust-desktop.yml`. Rust CI produces evaluation executable artifacts for Mac, Windows and Linux. They are not the supported GitHub Release installers; existing releases remain the Electron app during migration.

## Acceptance

Review `tasks/plan.md` and `tasks/todo.md` for ordered slices. This candidate uses Rust-drawn egui controls and OS-native Mac/Windows menus. It does not yet claim full accessibility, native text-edit behavior, rich text, account setup or mail capability. Those checks determine whether this toolkit proceeds. Existing data must be migrated explicitly and safely before cutover. Never test by opening the user's profile or connecting their accounts.

Initial CI uses Intel Mac runners because GitHub reported Apple Silicon runner capacity failures during this change. The Apple Silicon build and native-menu checks were performed locally. Cross-platform CI compilation does not replace clean-machine runtime acceptance.

## Keyboard and text selection (N02, partial)

- Tab / Shift+Tab traverse focusable controls. Inbox controls include their account in the accessible name.
- F6 / Shift+F6 cycle between the folder list, message list and displayed message body (when open).
- Click a message, or focus a message row using the keyboard. Up/Down open the previous/next message within the current Inbox scope; Home/End open the first/last. Navigation stops at the ends. Opening marks only that account's message read.
- The displayed body is an immutable text buffer: keyboard selection and copying are available, but typing cannot edit the message. Native Edit → Select All / Copy dispatch to the focused text control; command/control shortcuts remain available. Selection state is isolated per message/account.
- Only keyboard navigation requests that the selected row scroll into view; ordinary manual scrolling remains available.

These changes advance the toolkit evaluation, not account/provider readiness. Full screen-reader, IME, rich-text composing and Windows/Linux interactive acceptance remain pending. No existing profiles or real mail are used.

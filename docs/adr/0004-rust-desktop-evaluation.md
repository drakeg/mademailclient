# ADR: evaluate a Rust desktop replacement without a browser runtime

Status: evaluation authorized; final toolkit and retirement of Electron not yet accepted.

The owner prefers eliminating Electron and its browser/runtime boundary. Tauri retains a webview and therefore does not meet that preference. The future desktop app will be Rust with a non-web UI. Existing application releases remain until replacement acceptance.

## First candidate

Use eframe/egui 0.37.0 with AccessKit and the OpenGL renderer, plus muda 0.21.2 for native AppKit/Win32 menus. These are independent public libraries. No Mailcraft code/assets are incorporated. The panes use Rust-rendered widgets, not native AppKit/WinUI widgets. Linux currently uses an in-window menu. Rich-text composing, accessibility, IME, OS text-edit shortcuts, native menu dispatch and multi-window behavior require evidence before this toolkit is accepted.

The workspace separates a dependency-free mail model (`crates/mail-core`) from the evaluation UI (`apps/rust-desktop`). No networking, persistence, credentials, JS/IPC bridge, existing-profile access or remote mutation is present. Samples use `.invalid` addresses. The current Electron build is not replaced.

## Dependency and license review

- eframe/egui: MIT OR Apache-2.0. Official framework, documented platform accessibility feature; defaults disabled and only fonts, accessibility, OpenGL, X11/Wayland enabled. Custom GPU-rendered controls; not an assurance of complete accessibility.
- muda: MIT OR Apache-2.0. Native menus only on Mac/Windows in this candidate; no GTK dependency added to the Linux build.
- raw-window-handle 0.6.2: MIT OR Apache-2.0 OR Zlib; Windows-only typed handle access. One documented unsafe attachment operation relies on the live eframe window on the UI thread.
- Cargo.lock pins transitives. Preserve dependency and bundled font licenses for packaged distributions. No downloaded mail, HTML renderer, third-party app source or new network service is used.

Official references used for this original implementation:
- https://docs.rs/eframe/0.37.0/eframe/
- https://docs.rs/egui/0.37.0/egui/containers/panel/struct.Panel.html
- https://docs.rs/muda/0.21.2/muda/
- https://docs.rs/raw-window-handle/0.6.2/raw_window_handle/

## Acceptance / consequences

N01 delivers synthetic model behavior and compilable platform shell, not mail feature parity. CI compiles and tests on Mac/Windows/Linux and retains evaluation executables as artifacts. These are not signed installers or releases. N02 must validate keyboard, screen-reader and native event integration before provider implementation. N03–N07 in `tasks/plan.md` cover credentials, mail, attachments/rules, migration and installers. Existing OS-encrypted profile formats must be migrated explicitly with rollback; never probe a real profile during development.

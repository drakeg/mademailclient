# Rust desktop migration plan

Owner direction: Made Mail remains the product. Remove Electron and webviews from the future desktop runtime. No Mailcraft code, assets or implementation excerpts may be incorporated. Existing application functionality and encrypted profiles must be preserved until migration passes acceptance.

## Scope and build order

| Slice | Capability | Acceptance |
|---|---|---|
| N01 | Rust model and desktop shell | Original, offline synthetic mailbox; unified and individual Inbox; reading marks; proper OS window controls; Mac/Windows native menus; CI builds on all three OSes |
| N02 | Desktop experience validation | Keyboard navigation, assistive technology, IME, copy/select, resizing, multi-window compose and platform menu shortcuts validated on Mac and Windows before toolkit commitment |
| N03 | Credentials and account setup | OS keychain/credential manager; manual IMAP/SMTP and safe discovery; OAuth browser handoff; no credential or mail fixture copied from real profiles |
| N04 | Receive and mailbox actions | Read/send/flag/Junk/Not Junk/MOVE contracts; incremental sync, account isolation, stale UID guards and uncertain outcomes |
| N05 | Sending and attachments | Durable drafts, attachment limits and MIME; accepted/unknown no-retry behavior; original attachments forwarded correctly |
| N06 | Rules and purge | Rule planning parity; durable execution, native purge confirmations and snapshot safeguards |
| N07 | Migration and installers | Explicit rollback-safe profile conversion, clean-machine DMG/EXE/Linux installation and full acceptance; only then replace Electron downloads |

N01 is a toolkit evaluation, not an email-ready replacement. It must not open existing profiles or claim connected accounts. Use eframe/egui as a candidate Rust-rendered UI, AccessKit for accessibility and muda for OS-native Mac/Windows menus; these are public independent dependencies, not Mailcraft source. Controls are custom drawn, not AppKit/WinUI widgets. N02 decides whether this candidate meets the owner's polish requirements; a toolkit change is cheaper before provider work.

Existing web demo remains separate. Hosted functionality is deferred. Current Electron CI/installers remain while Rust acceptance is incomplete. No JS bridge or service process in the Rust executable.

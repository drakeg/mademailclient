# Rust read-only receiving (N04a)

This is the first receive path for the Rust evaluation, not full mail-client parity. Existing Release installers remain the Electron application. No existing profile is opened or migrated. No Mailcraft code or assets are used.

## User flow

Startup is empty and does not read credentials or connect. File → Add Account… (Mac: also Made Mail → Accounts…) opens settings. Save settings, choose **Read mail…** for a saved account, review the servers, then **Load folders and Inbox**. Only incoming credentials are used for receiving. Each explicit load signs in using the saved IMAP configuration. SMTP verification remains a separate operation.

The sidebar contains All Inboxes, account Inboxes and the server's other folders. Nonselectable hierarchy parents are disabled. Opening a folder loads its newest 50 messages; All Inboxes combines the loaded Inbox pages. Select a message to retrieve its text. Mailbox → Refresh Current Folder refreshes an individual selected folder; select an account folder first when viewing All Inboxes. There is no background polling or pagination yet.

Reading uses `EXAMINE`, header `BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)]`, and `UID FETCH … BODY.PEEK[]`. No read flags are written: unread badges reflect received server flags, even after opening a message. Reply, forward, sending, read/unread changes, Junk, delete, rules and purge remain disabled in the Rust app. They are later migration slices, not implied by successful sign-in or receiving.

`--sample` opens invented mail without reading credentials. `--account-fixture` additionally enables temporary synthetic account settings, and blocks both verification and receiving at runtime. Never enter real credentials in either test workflow. Synthetic tests do not open existing profiles or accounts.

## Boundaries

- Reuses verification's TLS 1.2 minimum, OS trust/hostname checks, STARTTLS refusal of downgrade, public-only pinned DNS answers and 25-second endpoint deadline. Certificate checks are never bypassed. The deadline covers socket work; platform trust evaluation has the limitation described in RUST_CONNECTION_VERIFICATION.md.
- At most one receive worker and one replaceable pending request. Latest selection supersedes an older response. There is no automatic retry or account-operation popup. Credential-store access is released before network work; credentials are zeroized when settings drop.
- Server UID, folder and UIDVALIDITY are kept separately from monotonically allocated UI IDs. Opening a body re-examines its mailbox and refuses changed UIDVALIDITY. Stale worker results and removed accounts cannot populate the UI. Credential removal disconnects the account from the session; an already running read may finish but its result is discarded.
- IMAP framing caps each line at 8 KiB, frame at 1,100,000 bytes and grammar nesting at 32 before invoking the parser. Literal lengths are checked before allocating/reading; literal contents are opaque. Each command caps aggregate bytes at 2,200,000 and responses at 1,024.
- Up to 512 listed folders, 1,024-byte server paths, 50 headers per page, 64 KiB per header block. Modified UTF-7 folder display is decoded separately from the exact path used in commands. Quotes/backslashes are escaped; control characters are rejected. Unsolicited incomplete header updates are ignored, never assigned invented UIDs.
- Full raw message cap is 1 MiB, including attachments: larger messages show a limit error. MIME parsing is capped at 16 levels, 256 parts and one encoded-message nesting level; parser-limit flags cause a visible refusal. Text display is capped at 262,144 characters. Sender/subject are capped at 512/1,024 characters. HTML is converted to text, never executed or displayed in a browser; no images, links or attachment files are fetched/opened.
- Memory-only cache retains each account's Inbox plus at most one other folder, and only one opened body. Switching back can reload mail; exit discards mail. There is no offline storage, real-time synchronization or resume of connected sessions.
- Errors are fixed application messages, not raw server text. Mail and credential contents are not logged.

## Dependencies and review

`imap-proto` 0.17.0 (MIT OR Apache-2.0) supplies the IMAP response grammar; local bounded framing runs before parsing or cloning. `mail-parser` 1.0.1 (Apache-2.0 OR MIT) supplies MIME, encoded headers, character decoding and HTML-to-text. It was selected after reviewing its current upstream changelog, parser limits, lazy decoding and source. New transitive `encodify` and `hashify` use Apache-2.0 OR MIT; `nom` uses MIT, and existing charset/SIMD dependencies retain their upstream licenses. Version 1.0 includes upstream SIMD/UTF-8 unsafe internals; using Rust does not itself establish parser safety. Keep limits and hostile-input tests when updating.

Sources: [IMAP grammar API](https://docs.rs/imap-proto/0.17.0/imap_proto/), [MIME upstream changelog](https://github.com/stalwartlabs/mail-parser/blob/main/CHANGELOG.md), [MIME parser limits](https://docs.rs/mail-parser/1.0.1/mail_parser/struct.MessageParser.html). This implementation uses public independent libraries, not code from another mail client.

## Verification and limits of evidence

Synthetic protocol tests cover folder/encoded-header decoding, stable UID references, read-only requests, changed mailbox identity, command injection, response tags, hostile literal lengths/nesting/truncation, and HTML-to-text. A synthetic localhost TLS fixture exercises authentication followed by folder listing and an empty Inbox. State tests cover UID collisions across folders, obsolete worker replies, removal and latest pending selection. Core tests isolate folder/account scopes. Existing TLS and JavaScript tests remain required.

Mac GUI acceptance uses only fictional sample mail and the temporary account fixture. CI builds/test checks cover Mac, Windows and Linux; compilation is not proof of real-provider, accessibility or clean-machine runtime acceptance. No real account was connected for development validation. OAuth-only providers still require browser sign-in work and publisher registrations. Sending, mutation safety, richer receive/sync and installer cutover remain subsequent work.

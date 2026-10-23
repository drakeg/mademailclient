# Desktop account connections

Made Mail starts empty. Use Made Mail → Add Account on macOS, File → Add Account on Windows, or the sidebar Add account button. Accounts can be added and removed repeatedly through Accounts. Removal forgets credentials and loaded messages in Made Mail; it never deletes mail on the server. Sample mail is available only through Explore fictional sample mail in Accounts.

## Current support

This first adapter supports public IMAP servers allowing username/app-password authentication over verified TLS on port 993. Enter your provider's published IMAP hostname, email address, username, and app password directly into the app. Never include credentials in GitHub issues or chat. Providers requiring OAuth, including Microsoft accounts with basic authentication disabled, need a future registered OAuth integration. Gmail policies may also require OAuth. This implementation cannot override provider or workplace policies.

The desktop app authenticates before saving an account, reads the newest 30 inbox headers per account, combines these in All inboxes, and allows each account's Inbox to be selected. Click a message to retrieve plain text. Search covers only loaded headers and fetched bodies. Refresh reloads these recent inboxes. Messages larger than 2 MB cannot be previewed. No pagination, other server folders, attachment opening, HTML rendering, incremental/background sync, SMTP sending, live flag changes, deletion, or rule execution is implemented. These remain backlog work, not completed client capabilities.

## Storage and trust boundaries

Account secrets remain in the Electron main process. The renderer uses fixed, origin-checked IPC methods: list/add/remove/inbox/body. Responses omit passwords. The entire versioned account file is encrypted with Electron safeStorage asynchronous APIs (OS Keychain on macOS, DPAPI on Windows); plaintext persistence is forbidden. Writes use an exclusive temporary file and atomic rename. Corrupt/unreadable files are preserved and reported, never silently replaced. Account operations are serialized. No message content is written to disk by this adapter. Removing an account rewrites the vault without its record; it is not a guarantee of forensic erasure from backups or disk snapshots.

IMAP uses read-only mailbox selection, verified certificates, pinned public DNS results with the original TLS server name, bounded message retrieval, disabled protocol logging, and no CLOSE/EXPUNGE commands. Local/private addresses and alternate ports are unsupported intentionally. Parsed mail is displayed as text, never HTML. Credentials exist transiently in the GUI during submission; the password field is cleared after submission and when the dialog closes. OS user-session compromise is outside this protection boundary.

## Dependency review

Runtime dependencies added for this adapter: imapflow 2.9.1 (MIT, maintained upstream IMAP protocol implementation), mailparser 3.12.4 (MIT, maintained Nodemailer MIME parser). Parsing and transport are too complex to implement safely as bespoke protocol code. Exact versions and transitive packages are locked. Installed with lifecycle scripts disabled; production dependency audit reported no known vulnerabilities on 2026-10-23. The package manager recorded explicit minimum-release-age exceptions for these newly published versions and three transitive mail packages; review these on dependency updates. Parsing uses a bounded input but still processes untrusted mail; keep dependency auditing in CI.

## Verification and remaining acceptance

Automated tests cover vault encryption through an injected crypto adapter, serialized updates, corruption preservation, unavailable encryption, untrusted IPC rejection, public-host validation, and read-only IMAP session cleanup with a synthetic client. They do not prove OS Keychain/DPAPI or a real provider login. Manual Mac/Windows credential persistence, restart, disconnect, invalid-password and provider-policy acceptance are still required with a disposable account. No personal credentials or messages are test fixtures.

The apps remain standalone Electron applications, packaged as macOS .app/DMG and Windows NSIS installers. End users do not need Node, pnpm, or a web server. Signed/notarized macOS distribution still needs Apple Developer credentials; Windows signing also needs a signing identity. Do not confuse a successful build with trusted installation acceptance.

Local verification on 2026-10-23: 26 unit tests passed, syntax checks passed, production audit clean, ARM64 .app packaging succeeded with runtime dependencies. The packaged launch test aborted with SIGABRT before a success marker in this execution environment, so GUI launch and real account acceptance are unverified. Browser inspection was also blocked by the tool's URL security policy. No security settings were bypassed. The GitHub platform build/smoke matrix remains the next verification gate.

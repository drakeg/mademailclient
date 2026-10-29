> 0.2.0 supersedes the earlier read-only/preview-only mailbox descriptions. See [MAIL_WORKFLOWS.md](MAIL_WORKFLOWS.md) for live actions, saved rules and folder mappings.

> Current alpha.5 update: real folders, paged reads, polling and plain-text sending are now implemented. The older read-only descriptions below are historical; see [SEND_RECEIVE.md](SEND_RECEIVE.md) for the current contract and remaining limits.

# Desktop account connections

Made Mail starts empty. Use Made Mail → Add Account or File → Add Account on macOS, and File → Add Account on Windows. Accounts can be added, edited, and removed through Accounts. Use Edit settings on an existing account to add SMTP without removing it. Removal forgets credentials and loaded messages in Made Mail; it never deletes mail on the server. Sample mail is available only through Explore fictional sample mail in Accounts.

## Current support

The adapter supports public IMAP servers on 993 with SSL/TLS or 143 with required STARTTLS, and outgoing SMTP on 465 with SSL/TLS or 587 with required STARTTLS. Enter an email address and leave the field to try automatic setup, or press Find settings. Review the suggested server settings and enter an app password. Manual settings remain available. Never include credentials in GitHub issues or chat. Providers requiring OAuth, including Microsoft accounts with basic authentication disabled, need a future registered OAuth integration. Gmail policies may also require OAuth. This implementation cannot override provider or workplace policies.

The desktop app tests the incoming and configured outgoing logins before saving an account, reads the newest 30 inbox headers per account, combines these in All inboxes, and allows each account's Inbox to be selected. Click a message to retrieve plain text. Search covers only loaded headers and fetched bodies. Refresh reloads these recent inboxes. Messages larger than 2 MB cannot be previewed. No pagination, other server folders, attachment opening, HTML rendering, incremental/background sync, SMTP sending, live flag changes, deletion, or rule execution is implemented. These remain backlog work, not completed client capabilities.

## Storage and trust boundaries

Account secrets remain in the Electron main process. The renderer uses fixed, origin-checked IPC methods: list/add/update/discover/remove/inbox/body. Responses omit passwords. The entire versioned account file is encrypted with Electron safeStorage asynchronous APIs (OS Keychain on macOS, DPAPI on Windows); plaintext persistence is forbidden. Writes use an exclusive temporary file and atomic rename. Corrupt/unreadable files are preserved and reported, never silently replaced. Account operations are serialized. No message content is written to disk by this adapter. Removing an account rewrites the vault without its record; it is not a guarantee of forensic erasure from backups or disk snapshots.

IMAP uses read-only mailbox selection, verified certificates, pinned public DNS results with the original TLS server name, bounded message retrieval, disabled protocol logging, and no CLOSE/EXPUNGE commands. Local/private addresses, plaintext connections, SMTP port 25 and nonstandard ports are unsupported intentionally. Both protocols pin validated public DNS results and verify the original host certificate; STARTTLS is mandatory when selected. Parsed mail is displayed as text, never HTML. Credentials exist transiently in the GUI during submission; both password fields are cleared after submission and when the dialog closes. OS user-session compromise is outside this protection boundary.

## Dependency review

Runtime dependencies added for this adapter: imapflow 2.9.1 (MIT, maintained upstream IMAP protocol implementation), mailparser 3.12.4 (MIT, maintained Nodemailer MIME parser). Parsing and transport are too complex to implement safely as bespoke protocol code. Exact versions and transitive packages are locked. Installed with lifecycle scripts disabled; production dependency audit reported no known vulnerabilities on 2026-10-23. The package manager recorded explicit minimum-release-age exceptions for these newly published versions and three transitive mail packages; review these on dependency updates. Parsing uses a bounded input but still processes untrusted mail; keep dependency auditing in CI.

## Verification and remaining acceptance

Automated tests cover vault encryption through an injected crypto adapter, serialized updates, corruption preservation, unavailable encryption, untrusted IPC rejection, public-host validation, and read-only IMAP session cleanup with a synthetic client. They do not prove OS Keychain/DPAPI or a real provider login. Manual Mac/Windows credential persistence, restart, disconnect, invalid-password and provider-policy acceptance are still required with a disposable account. No personal credentials or messages are test fixtures.

The apps remain standalone Electron applications, packaged as macOS .app/DMG and Windows NSIS installers. End users do not need Node, pnpm, or a web server. Signed/notarized macOS distribution still needs Apple Developer credentials; Windows signing also needs a signing identity. Do not confuse a successful build with trusted installation acceptance.

Local verification on 2026-10-23: 26 unit tests passed, syntax checks passed, production audit clean, ARM64 .app packaging succeeded with runtime dependencies. The packaged launch test aborted with SIGABRT before a success marker in this execution environment, so GUI launch and real account acceptance are unverified. Browser inspection was also blocked by the tool's URL security policy. No security settings were bypassed. The GitHub platform build/smoke matrix remains the next verification gate.

## Automatic setup and outgoing settings (2026-10-26)

Built-in settings cover Gmail/Googlemail, iCloud/me.com/mac.com, Outlook.com/Hotmail/Live/MSN, Yahoo/ymail/rocketmail, and Fastmail's fastmail.com/fastmail.fm addresses. These presets do not create any default accounts. Other domains are checked for DNS SRV records for IMAPS/IMAP and secure SMTP submission. Only the domain is sent to DNS; discovery never authenticates or transmits a password. Partial discovery fills whichever server is found; missing or timed-out records leave manual setup available. Built-in provider settings are suggestions; custom domains without supported SRV records may need manual entry even if their provider is known. MX records are not used as outgoing submission settings. HTTP autoconfig, Exchange Autodiscover, SRV weighted failover and arbitrary-domain provider guessing are not implemented.

Results identify their source. Review both server names before pressing Test and add account or Test and save changes. Manual field edits survive discovery; late results are discarded if the address/form changes or the dialog closes. Microsoft presets warn that OAuth remains unsupported. Google account policy may require OAuth rather than an app password; discovery cannot change that policy.

SMTP can reuse the incoming username/password or have separate credentials. On edit, a blank password keeps the saved secret only while its server, port, security and username are unchanged; re-enter passwords after changing those destinations. Both login checks must pass before any account record changes. Failures distinguish incoming and outgoing checks without exposing raw provider errors. Legacy incoming-only records still load; SMTP can be added through Edit settings. Both secrets are encrypted together in the existing versioned vault, requiring no destructive migration.

SMTP uses Nodemailer verify(), which connects, negotiates TLS, requires authentication and disconnects without sending a message. Verification does not prove that a provider will accept a particular sender or deliver messages. The compose/send interface is still unfinished. This increment configures outgoing access; it does not enable sending, automatic replies or server-side rules.

Nodemailer 10.2.1 (MIT-0) is now an exact direct dependency, already present in the locked transitive graph. No new transitive packages or install scripts were introduced. Production audit on 2026-10-26 reported no known vulnerabilities. Source references and acceptance criteria are in [the setup plan](ACCOUNT_SETUP_PLAN.md).

Tests cover separate/reused SMTP credentials, redacted summaries, secure transport options, a real local SMTP fixture refusing TLS downgrade before AUTH, preservation on failed verification, legacy account edits, credential destination changes, domain-only discovery, partial discovery and timeouts. Live provider login and OS credential persistence still require disposable-account acceptance; fixture tests are not evidence that a specific personal/work account can connect.

## Provider chooser and browser authorization

Add Account now offers Gmail/Google Workspace, Yahoo, iCloud and Other email. The first three offer simplified app-password setup with prefilled servers and usernames; advanced settings remain expandable. Gmail/Yahoo browser authorization is implemented behind registered public OAuth clients, but no registrations currently exist, so default builds clearly disable that option. See [publisher registration and sign-in status](PROVIDER_SIGN_IN.md). The earlier statement that all OAuth code is absent is superseded by this increment; provider registration/approval and live acceptance are not complete.

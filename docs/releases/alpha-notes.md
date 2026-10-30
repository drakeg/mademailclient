# Made Mail 0.2.1 — account-operation and Read-state fixes

## Fixed
- Opening mail during refresh/account work no longer produces “another account operation is in progress.” Main-process bounded queues accept overlapping reads, prioritize pending body reads and serialize account changes.
- A confirmed Read/Flag change is retained when an older refresh response arrives. Loaded message text survives metadata refreshes for the same message; changed account identity/server settings invalidate cached text.
- Queued operations recheck the requesting window before execution. Closed or unauthorized windows cannot execute waiting requests.
- Moved/deleted messages now produce an appropriate refresh message instead of being mistaken for oversized messages.
- Mac source installs replace the application without keeping previous-version backup copies. The new bundle is staged first; a failed staging copy leaves the existing app untouched. Accounts/rules/preferences are retained in the existing profile.

## Included from 0.2.0
Connected read, compose/reply/forward, Delete-to-Trash, Move, Archive, Junk/Not Junk, read/unread and flags; saved account settings and folder mappings; saved ordered rules with exceptions, enable/disable, preview/apply and new-inbox processing while the app is open. Alpha.5 does not contain these live mailbox controls: verify About Made Mail reports 0.2.1 after updating.

## Install / update
Windows x64 EXE and Linux DEB/AppImage downloads plus SHA256SUMS.txt are attached. Installers are unsigned previews; keep OS protections and the Electron sandbox enabled. On Debian/Ubuntu: `sudo apt install ./Made-Mail-0.2.1-linux-amd64.deb`.

Mac source install: quit Made Mail, pull this version in your checkout, then run `pnpm desktop:install:mac`. Requires Node 22+ and pnpm 11.25.0. The app is installed into /Applications. No trusted downloadable Mac binary is included pending Developer ID signing/notarization. Source archives are not built apps.

## Validation / limits
Regression tests reproduce the overlap and stale-read-state failures with synthetic clients/messages; packaged checks also exercise the overlap inside the installed main process. This does not claim live-provider acceptance. See docs/MAIL_WORKFLOWS.md for account permissions, rule execution and retention limits. Attachments, server drafts, permanent purge and automatic replies remain unfinished. No failed or unknown mail mutation is automatically retried by this patch.

# Made Mail 0.2.0 — working mailbox actions and saved rules

This milestone adds the core mailbox operations missing from alpha.5. It is a GitHub prerelease pending real-provider/platform acceptance; changing its version does not claim full-time readiness.

## What now works
- Read connected message bodies without competing with background refresh. Selecting a message saves its read flag on the server.
- Delete-to-Trash, Move, Archive, Junk/Not Junk, read/unread and flags in the reader and native menus for writable IMAP accounts.
- Saved account/server credentials (retained across updates) and explicit saved Trash/Junk/Archive folder mappings.
- Saved rules with all/any conditions, exceptions, account scope, ordering, enable/disable and stop processing. Actions: move, Junk, Trash, read/unread or flag.
- Preview and explicitly apply saved rules to recent existing inbox mail. Enabled rules process newly received inbox mail while the app is open.
- Durable mailbox-action history and deduplication, with no blind retry of unknown outcomes and no permanent-delete fallback.
- Compose, reply/reply-all, plain-text forward, encrypted local drafts and SMTP sending status from the previous release.

## Install / update
Windows x64 setup EXE and Linux x64 DEB/AppImage are below, with SHA256SUMS.txt. Installers are unsigned previews; clean-machine acceptance and publisher trust remain pending. Keep OS protections and the Electron sandbox enabled.

On Debian/Ubuntu: `sudo apt install ./Made-Mail-0.2.0-linux-amd64.deb`. The AppImage filename uses `linux-x86_64`.

Mac: no trusted ready-to-install Mac binary is included. Quit Made Mail, run `git pull` in the existing checkout and then `pnpm desktop:install:mac` (Node 22+, pnpm 11.25.0). It copies the app into /Applications and replaces the existing application without keeping a backup. Account/rule data is retained in the existing profile. Confirm About Made Mail says 0.2.0. Source ZIP/TAR assets are not built apps.

## Important limits
Read-only authorizations stay read-only. A server must advertise IMAP MOVE for moving/deleting; unsupported servers fail clearly. Use Mailbox → Folder Settings if special folders are missing. Rules do not permanently delete or automatically reply. Automatic rules run only while open; the initial baseline leaves existing mail alone. Preview/Apply handles 50 recent inbox messages; automatic catch-up is bounded to 5,000. See docs/MAIL_WORKFLOWS.md.

Outgoing attachments, attachment forwarding, server drafts, offline caching, full-server search and permanent emptying of Trash are not implemented. Browser sign-in still requires publisher registrations. The agent's automated/browser checks use synthetic mail and do not claim live-provider acceptance. Test with a disposable account before relying on the app as your only client.

# Made Mail 0.1.0-alpha.5 — send/receive preview

This is an experimental milestone, not a full-time-client recommendation. Test with disposable accounts first. No live-provider acceptance is claimed by synthetic tests.

## Added
- Actual IMAP server folders, 50-message pages, older-message loading in account folders and inbox polling every minute while open.
- File → New Message; plain-text SMTP sending, reply/reply-all and text forwarding, with a sending-account selector.
- Encrypted local drafts and submission records under File → Local Drafts and Sending Status. These are separate from server Drafts.
- Durable single-attempt submission records. Unknown outcomes remain locked across restarts; the app never automatically resubmits them.
- Sent-folder copies use the server's special-use Sent folder. Gmail SMTP manages its own copy. Copy failure never resends mail.
- Original Made Mail desktop icon and Linux AppImage/DEB packages.

## Downloads and installation
- Windows x64: unzip the setup download if necessary and run the `.exe`. It is unsigned; OS reputation/installation acceptance is pending. Do not disable OS security protections.
- Linux x64: install the `.deb` with `sudo apt install ./Made-Mail-0.1.0-alpha.5-linux-amd64.deb` on supported Debian/Ubuntu, or make the AppImage executable and run it. Keep the Electron sandbox enabled. A supported secret service is required for encrypted credentials.
- macOS: **no ready-to-install Mac binary is included in this release**. Developer ID signing/notarization is still unavailable; the old unsigned DMG is not fixed. Build this release's reviewed source on your Mac with Node 22+, pnpm 11.25.0, and `pnpm desktop:install:mac`. This copies the app to /Applications; see docs/INSTALLERS.md. GitHub's source archives contain source, not a built app.
- SHA256SUMS.txt covers the three declared Windows/Linux installer files. Only installers from the successful build for this exact source commit are published.

## Limits
No attachments in outgoing mail, server drafts, offline cache, IDLE push, full-mailbox search, live move/Junk/Trash/flags, or automatic rules execution yet. Reading is a bounded plain-text preview (2 MB source / 200,000 text characters). Loaded-message search does not search the full server mailbox. Sequence-based older-page navigation can shift when another client deletes mail; refresh to reconcile.

SMTP acceptance is not proof of delivery. Partial recipient rejection and missing Sent copies are shown. If submission outcome is unknown, check provider Sent and confirm receipt before composing another copy. Do not blindly resend. Sending records hold message content encrypted locally until explicitly removed; uninstalling does not purge the profile.

Gmail/Yahoo browser authorization still needs publisher registrations and approval. Yahoo's current OAuth grant is read-only and cannot send; app-password SMTP may be used where the provider permits it. Work-provider policies may prohibit app passwords.

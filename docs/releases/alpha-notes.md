# Made Mail 0.4.0 — Mac downloads and sending attachments

## Install from Releases
All six installers are attached with SHA256SUMS.txt. No Git, Node or pnpm is needed.

- **Mac Apple Silicon:** Made-Mail-0.4.0-mac-arm64.dmg
- **Mac Intel:** Made-Mail-0.4.0-mac-x64.dmg
- **Windows x64:** Made-Mail-0.4.0-win-x64.exe
- **Linux x64:** DEB, RPM and AppImage

On Mac, quit Made Mail, open the DMG, drag Made Mail.app to Applications and choose Replace to update. Eject the disk image and launch from Applications. App profile paths remain unchanged; no previous-version app backups are created.

**Mac signing notice:** these downloads have ad-hoc integrity signatures. They are **not Developer ID signed and not notarized by Apple**. macOS may require its normal per-app approval or block launch according to policy. See [Apple's app-opening guidance](https://support.apple.com/en-us/102445). The installer does not remove quarantine or change security settings. Windows installers also lack a trusted publisher signature.

## Sending attachments
- Attach Files in new messages, replies and forwards uses the native file picker. Review filenames and remove individual files before sending.
- Drafts retain encrypted copies of selected bytes, so reopening a draft keeps its attachments even if the original file changes or disappears.
- Forward imports the original attachments and verifies their identity/digests. Failed imports block Send across saves/restarts until you Retry or explicitly choose Forward text only.
- Up to 10 files and 10 MiB total per outgoing message; 40 MiB total attachment storage across local drafts/submission records. Provider limits may be smaller. Removing old local records frees retained attachment storage.
- Existing duplicate-send protection and durable accepted/unknown submission status also cover attachment mail. No automatic resubmission is added.

See docs/ATTACHMENTS.md and docs/INSTALLERS.md for limits and installation details. Synthetic MIME/filesystem/renderer and packaged-app checks cover implementation; real-provider, native dialog and clean downloaded-install acceptance remain pending. No personal mail was used or sent by the agent. Server drafts, offline caching, permanent purge, automatic responses and OAuth publisher registrations remain open.

# Made Mail 0.4.1 — Delete feedback hotfix

## Fixed
- Pending Delete now shows **Deleting…** and **Moving this message to Deleted Items…**, rather than the misleading “This action is unavailable for this message or account.”
- Busy state no longer makes a writable account appear read-only. Repeated mailbox changes remain blocked while a change is running; controls restore afterward.
- Messages already in Deleted Items, read-only accounts and missing selections explain their specific disabled state.

This fix addresses misleading command feedback. Delete continues to MOVE messages to the configured/server Trash folder. Server errors remain visible; no permanent deletion or unsafe fallback was added. Slow synthetic MOVE testing verified one operation, removal from Inbox and appearance in Trash. Private mail was not accessed.

## Downloads and installation
Mac Apple Silicon and Intel DMGs, Windows x64 EXE and Linux DEB/RPM/AppImage are attached with checksums. Quit Made Mail, open the matching DMG and drag Made Mail.app into Applications, choosing Replace. No Git or pnpm is required. Existing accounts, rules and drafts use the same profile paths.

Mac previews are **ad-hoc signed**, **not Developer ID signed**, and **not notarized by Apple**. macOS may require normal per-app approval; see [Apple's guidance](https://support.apple.com/en-us/102445). Windows previews also lack a trusted publisher signature. No installer changes OS trust settings.

All 0.4.0 sending/receiving attachment support remains included. Real-provider and clean-machine acceptance remain pending. Mailbox emptying, permanent-delete rules, automatic replies, offline caching and server drafts remain unfinished.

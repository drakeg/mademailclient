# Made Mail 0.3.0 — received attachments

## Added
- Save received attachments from the reading pane with a native **Save As…** dialog. Filenames, decoded sizes and media types appear below the message. Saving never automatically opens a file.
- Received message downloads support up to 25 MiB, replacing the live reader's previous 2 MiB text-preview path. Individual saved attachments are limited to 20 MiB, with at most 100 per message. Text and attachment metadata survive folder refresh.

## Save behavior
Choose a new filename when one already exists: existing files and symlinks are refused, including after the OS dialog offers replacement. Saves refetch and verify the message/attachment; stale or incomplete sources fail clearly. See docs/ATTACHMENTS.md. Forwarding includes text only; sending attachments is not implemented yet.

## Installation
Windows EXE and Linux RPM/DEB/AppImage downloads plus SHA256SUMS.txt are attached after the exact-commit platform build succeeds. For Fedora: `sudo dnf install ./Made-Mail-0.3.0-linux-x86_64.rpm`. Mac signed DMGs remain unavailable pending Apple Developer credentials; quit the app, `git pull` and run `pnpm desktop:install:mac` to update /Applications/Made Mail.app locally. No backup copies are retained. Account/rule/draft profile paths are unchanged.

## Validation and limits
Synthetic MIME, filesystem, authorization and renderer checks cover the new path; native dialog and real-provider acceptance remain pending. No private mail was used. Existing SMTP, mailbox actions, saved rules and Read-state fixes remain included. Outgoing attachments, server drafts, offline caching, permanent purge, automatic responses and OAuth publisher registrations remain unfinished. Keep OS protections and Electron's sandbox enabled.

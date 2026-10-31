# Made Mail 0.2.2 — installer coverage

## Added
- Linux x64 RPM installer alongside DEB, AppImage and Windows EXE. Install on Fedora with `sudo dnf install ./Made-Mail-0.2.2-linux-x86_64.rpm`. RPM metadata and packaged synthetic launch are checked in CI; native distro installation acceptance remains pending.
- Protected Apple Silicon and Intel Mac signing/notarization release jobs. Trusted DMGs are included only when the maintainer enables signing and both jobs pass. Without Developer ID/notarization credentials, no Mac installer is published. See docs/MAC_SIGNING.md for setup.

## Included mail features
All 0.2.1 account-operation/Read-state fixes, live mailbox actions, sending, saved accounts and rules remain included. See docs/MAIL_WORKFLOWS.md for capabilities and limits. Accounts and profile paths are unchanged.

## Installation
Use attached installers and SHA256SUMS.txt. Source ZIP/TAR files are not installers. On Mac, until trusted DMGs are available, quit Made Mail, run `git pull` then `pnpm desktop:install:mac` in your checkout. This replaces /Applications/Made Mail.app without retaining backup copies. Keep OS protections and Electron's sandbox enabled.

## Limits
Preview status remains: live-provider and clean-machine install acceptance are pending. OAuth registrations, attachments, server drafts, permanent purge and automatic responses remain unfinished.

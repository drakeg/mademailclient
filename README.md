# Made Mail

An open-source email client bringing existing accounts into one workspace, inspired by familiar Outlook and Apple Mail workflows.

## Status
Foundation prototype, not a production email client. The browser demo can display optional fictional messages, supports unified/account inboxes and search, and previews rules. The desktop alpha now offers GUI-managed IMAP/SMTP app-password settings, automatic server discovery, OS-encrypted credentials and read-only recent inbox retrieval. SMTP settings are tested and saved; composing/sending remains unfinished. It starts with no accounts; fictional sample mail is optional. Browser OAuth code for Gmail/Yahoo is implemented but unavailable in unregistered builds; the publisher registrations and real-provider acceptance are still pending. Sending, full synchronization and live mail actions remain unimplemented. See [provider sign-in prerequisites](docs/PROVIDER_SIGN_IN.md). See [account setup and limits](docs/ACCOUNTS.md). Desktop packaging targets Mac DMG, Windows setup EXE and Linux DEB/AppImage; see [desktop setup](docs/DESKTOP.md). Installer signing and platform acceptance testing remain pending.

## Installable desktop apps (primary delivery)

Start with [installation instructions](docs/INSTALLERS.md): a local Mac build/install script, Windows setup EXE, and Linux DEB/AppImage workflow. Signed Mac downloads remain blocked on Developer ID and notarization.

See [desktop setup and installer builds](docs/DESKTOP.md). Mac and Windows desktop apps take priority; hosted web delivery follows later. Both use bundled interface assets without requiring a running web server.

## Run the browser prototype locally
Requires Node.js 22 or newer. The browser demo needs no credentials. Install locked dependencies with `pnpm install --frozen-lockfile` before running tests or the desktop app.

```sh
npm run dev
# Open http://127.0.0.1:3000
npm test
npm run check
```

The server binds to localhost and is a development server, not a hosted production service. Stop with Ctrl+C. Demo state resets on reload.

## Product direction
Mac, Windows, and hosted/self-hosted web access to existing accounts; no mailbox hosting or new email addresses. Unified inbox with individual account folders; Outlook-style ordered rules with conditions, exceptions, stop processing, preview, and audit history. Required actions: move, Junk, Deleted Items, permanent deletion, and automatic responses. Background rules require an always-on service or provider-native rule support.

## Repository
- `apps/web`: dependency-free browser prototype.
- `packages/core`: pure rule validation and action planning.
- `test`: meaningful domain tests using Node's test runner.
- `docs`: requirements, architecture, backlog, security, and decisions.

Start with [project plan](docs/PROJECT_PLAN.md), [architecture](docs/ARCHITECTURE.md), [contributing](CONTRIBUTING.md), [CI/CD](CICD.md), and [agent guidance](AGENTS.md).

## License
MIT; see LICENSE. This is an original implementation and is not affiliated with Microsoft or Apple. Do not copy proprietary code, assets, or branding.

## Alpha testing and releases
See [desktop testing](docs/TESTING.md) and [alpha acceptance status](docs/releases/alpha-acceptance.md). Platform installers are built by GitHub Actions. Matching alpha version tags create a draft prerelease only after all four packaged-app smoke tests pass. Normal distribution remains gated on native installation acceptance and signing/notarization. Release source archives are not installers.

## Mail workspace

Desktop commands use native OS menus. Add Account and Accounts/Settings live in the application/File menu; Rules lives in Mailbox. The left pane contains only mailbox/folder navigation. Selected-message commands live in the right reading pane and Message menu, with contextual Junk/Not Junk. See [menu and layout contract](docs/MENU_LAYOUT.md) for current capabilities and limitations.

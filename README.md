# Made Mail

An open-source email client bringing existing accounts into one workspace, inspired by familiar Outlook and Apple Mail workflows.

## Status
Version 0.2.2 adds RPM packaging and a protected Mac signing/notarization release job (awaiting credentials). The mail features from 0.2.1 include live mailbox actions and saved rules to the connected IMAP/SMTP workflow: read, reply/forward, send, move, Delete-to-Trash, Archive, Junk/Not Junk, read/unread and flags. Accounts, folder mappings, local drafts and rules are saved with OS encryption. Overlapping account reads are queued instead of rejected, confirmed read/flag changes survive refresh races, and Mac source updates replace the application without retaining backup copies. Rules support ordered conditions/exceptions, preview/apply for existing recent mail, and newly received inbox processing while the app is open. See [current mail workflow contract](docs/MAIL_WORKFLOWS.md) and [downloads](https://github.com/drakeg/mademailclient/releases). Real-provider acceptance remains pending. Attachments, server drafts, offline caching and permanent purge are not implemented. OAuth browser sign-in still needs publisher registrations. Trusted Mac downloads remain blocked on Developer ID/notarization; source installation is available.

## Installable desktop apps (primary delivery)

Start with [installation instructions](docs/INSTALLERS.md): a local Mac build/install script, Windows setup EXE, and Linux DEB/RPM/AppImage workflow. Signed Mac downloads remain blocked on Developer ID and notarization.

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
See [desktop testing](docs/TESTING.md) and [alpha acceptance status](docs/releases/alpha-acceptance.md). Platform installers are built by GitHub Actions. Maintainers publish explicitly requested Windows/Linux preview releases from the release/milestone-* branch after a successful installer run for the exact commit. Mac binary distribution remains separately gated. Normal distribution remains gated on native installation acceptance and signing/notarization. Release source archives are not installers.

## Mail workspace

Desktop commands use native OS menus. Add Account and Accounts/Settings live in the application/File menu; Rules lives in Mailbox. The left pane contains only mailbox/folder navigation. Selected-message commands live in the right reading pane and Message menu, with contextual Junk/Not Junk. See [menu and layout contract](docs/MENU_LAYOUT.md) for current capabilities and limitations.

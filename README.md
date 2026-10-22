# Made Mail

An open-source email client bringing existing accounts into one workspace, inspired by familiar Outlook and Apple Mail workflows.

## Status
Foundation prototype, not a production email client. The browser demo displays fictional messages, supports unified/account inboxes and search, and previews rules. It does not connect accounts, persist rules, send mail, execute actions, or run background jobs. No desktop installers exist yet.

## Run locally
Requires Node.js 22 or newer. No external packages or credentials are required.

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

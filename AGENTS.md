# Contributor and agent instructions

Read README.md, CONTRIBUTING.md, docs/ARCHITECTURE.md, and docs/PROJECT_PLAN.md before changes. Keep implemented behavior separate from planned features. Work on a topic branch; do not merge or deploy without maintainer direction.

Keep domain logic in packages/core independent of UI and provider SDKs. Use synthetic fixtures only. Never commit messages, passwords, OAuth tokens, or account identifiers from real users. Render mail content as untrusted data; plain text is the default.

Rule planning is pure and cannot mutate mail. Execution belongs behind an authorized provider adapter and durable worker. Permanent deletion must never be a fallback for unsupported Trash or Junk. Automatic replies need durable cooldown and loop prevention before execution is introduced.

Run `npm test` and `npm run check`; exercise changed UI manually. Add behavioral tests for rule changes and adapter security boundaries. Update documentation and backlog statuses with evidence. Do not claim provider integration, desktop support, or production readiness from mocks.

No dependency additions without a documented need and license/security review. Prefer small cohesive PRs. Do not create parallel agents unless explicitly requested by the user.

Keep application commands in native OS menus (and the browser top menu). The sidebar is mailbox/folder navigation only: do not reintroduce Rules, Add Account, settings, or utility commands there. Selected-message actions belong in Message/the reading pane and must reflect capabilities and Junk/Not Junk context. Read docs/MENU_LAYOUT.md before workspace changes.

# Contributing

## Getting started
Fork the repository, clone your fork, install Node.js 22+, and follow README.md. No account credentials are needed for the demo. Pick a Ready backlog item or open a feature proposal before large changes. Maintainers confirm scope and acceptance criteria in the issue.

## Workflow
1. Create `feat/<short-name>`, `fix/<short-name>`, or `docs/<short-name>` from the default branch.
2. Describe the problem, intended behavior, and acceptance criteria in an issue. Reference a story ID from docs/PROJECT_PLAN.md when applicable.
3. Make one cohesive change. Keep provider code behind adapters; document migrations and changed configuration.
4. Run `npm test` and `npm run check`. For UI changes record keyboard, narrow-screen, empty-state, and relevant interaction checks with screenshots if useful.
5. Open a PR with the provided template. Include validation results and known limitations. A maintainer reviews before merging; resolve feedback and keep CI green.

Do not use production accounts for automated tests. New dependencies must explain need, maintenance, license compatibility, and security implications. Submit original work you have the right to contribute; contributions are under the repository's MIT license. No CLA is currently required.

## Useful contributions
Accessible UI, rule semantics and tests, provider capability research, documentation corrections, localization groundwork, and reproducible bug reports are welcome. Provider integration and destructive actions require design review before implementation.

## Community conduct
Be respectful and specific. Critique ideas, avoid harassment, and remove private information from reports. Maintainers may moderate or close abusive contributions. Contact the repository owner through GitHub for conduct concerns; never include sensitive mail in public discussions.

## Security
Follow SECURITY.md for private reports. Do not publish credentials or exploit details in an issue.

Desktop account contributions must preserve empty startup and GUI add/remove support. Read [the current account contract](docs/ACCOUNTS.md) before changing IPC, credentials, or provider access. Keep transport read-only until provider mutations have explicit capability and retry semantics. Test with synthetic clients and disposable accounts; never commit a personal account vault. OS credential persistence and actual provider acceptance must be reported separately from mock tests.

Account setup changes must preserve manual overrides, stale discovery cancellation, TLS enforcement and password redaction. SMTP verification must not send mail. Use domain-only discovery; never probe guessed servers with saved credentials.

# Desktop apps first

Mac and Windows installers are the primary product deliverables. Hosted web access is a later delivery track. The desktop app bundles the interface and rules code; it does not require a browser tab, hosted website or localhost development server.

## Development
Use Node.js 22+ and pnpm 11. Run `pnpm install --frozen-lockfile`, then `pnpm desktop`. Build on the target operating system:

- Mac: `pnpm desktop:mac` produces Apple Silicon and Intel DMG files under dist/.
- Windows: `pnpm desktop:win` produces an x64 NSIS setup EXE under dist/.
- `pnpm desktop:pack` produces an unpacked app for local inspection.

The installers contain the synthetic-mail prototype. Connecting real accounts, persistence and production rule execution remain unfinished. Windows ARM is not yet targeted. Desktop state currently resets when reloaded.

## Installer workflow
The Desktop installers workflow builds Mac and Windows artifacts on their respective GitHub runners. Download the artifacts from the workflow run; these are test builds, not published releases. Installer generation is separate from install/uninstall acceptance testing. No signing keys, notarization credentials, auto-update feed or automatic release publishing are configured. Unsigned artifacts may be blocked or warned about by the OS. Do not bypass OS protections; trusted distribution requires signing/notarization work.

## Security boundary
Electron sandbox, context isolation and web security are enabled. The renderer has no Node access, preload bridge, remote content, IPC or granted device permissions. An allowlisted custom protocol serves bundled files and applies CSP. Navigation and popups are blocked. Real mail HTML, OAuth flows and native credentials require separate designs before introduction.

## Acceptance checklist before public release
Test install, launch from Applications/Start Menu, inbox and rule-preview behavior without a server, close/reopen, uninstall and upgrade on Intel/Apple Silicon Macs and Windows x64. Record OS versions/results. Add credential storage, safe OAuth handoff and update verification before real-account beta. Configure signing and notarization in restricted CI environments, then verify OS trust on clean systems.

## Recorded validation (2026-10-22)
13 automated tests and syntax checks passed locally. electron-builder generated both Apple Silicon and Intel `.app` bundles. Local DMG creation failed at hdiutil (`Device not configured`), so DMG output is not validated. ZIP archives preserve the built app bundles as a fallback. Native UI launch inspection timed out; install/launch acceptance is still pending. Windows packaging is configured but has not been built or tested in this environment. The GitHub Actions API reported no runs after the initial push; workflow execution is not verified.

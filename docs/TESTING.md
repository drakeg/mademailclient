# Desktop testing guide

## Current safe scope
Use fictional fixtures only. The app cannot connect accounts or send mail. Test builds are unsigned. Do not disable OS security protections; if the OS blocks a build, record the message and stop that installation test. Signing/notarization is a separate release gate. Use a spare Mac/user profile or disposable Windows VM rather than a daily work environment. Snapshot the VM first; keep shared folders, clipboard and personal credentials out of the VM.

## Automated checks
With Node 22+ and pnpm 11 installed:

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm test
pnpm desktop:pack
```

Run `pnpm desktop:smoke "<path-to-packaged-executable>"` on the same platform/architecture as the bundle. The runner creates and removes a temporary app profile, enforces a timeout and requires an explicit success marker. It verifies renderer isolation, native menu presence, bundled UI load, account filtering, search/empty state and rule preview. It is not an installer test. Keep stdout/stderr and record failures as failures.

## Manual installation acceptance
For each Mac architecture and Windows x64, record OS version, app version, commit, installer SHA-256, tester and date in docs/releases/alpha-acceptance.md.

1. Download only from the repository's matching workflow or release. Compare SHA-256 with the manifest (`shasum -a 256 <file>` on Mac; `Get-FileHash <file> -Algorithm SHA256` in PowerShell). A checksum detects differences; code signing establishes publisher identity.
2. Install without admin rights where supported. Stop and record unexpected permissions or OS trust blocks.
3. Launch from Applications/Start Menu with no development server running. Verify icon, title and all three panes.
4. Test native menus, Copy/Paste, zoom, window close/reopen and Quit/Exit. On Mac closing the last window should leave the app running; Dock activation reopens it. Windows should exit after the last window closes.
5. Test All inboxes, each account Inbox and Sent, Projects, Unread/Flagged, matching and empty search, compact spacing, sample archive/junk/trash and read/flag actions. No operation may touch real mail.
6. Open Rules, preview an invoice move, test missing folder validation and Escape/close. Tab through controls and verify visible focus. Check screen-reader labels and enlarged text.
7. Quit/relaunch; confirm sample state resets as documented. Test offline launch. Verify no real account or mail-sending action is offered as working.
8. Uninstall and inspect remaining app data. Record leftovers; do not remove unrelated folders. Upgrade testing requires a second version and stays pending until that exists.

## Later account integration testing
Use dedicated disposable accounts populated with synthetic messages. Start with read-only sync, then reversible moves, then replies to controlled recipients. Enable permanent deletion and auto responses only after idempotency, loop suppression, cooldown, retry and capability tests pass. Never use personal/work mailboxes as the first integration test.

## Release decision
Build and smoke success permit a draft only. A maintainer reviews native installation results, known issues and signing status before publication. Public normal-use distribution requires signed Windows binaries and signed/notarized Mac packages. No automatic promotion is configured.

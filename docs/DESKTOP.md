# Desktop apps first

Mac and Windows installers are the primary product deliverables. Hosted web access is a later delivery track. The desktop app bundles the interface and rules code; it does not require a browser tab, hosted website or localhost development server.

## Development
Use Node.js 22+ and pnpm 11. Run `pnpm install --frozen-lockfile`, then `pnpm desktop`. Build on the target operating system:

- Mac: `pnpm desktop:mac --arm64` or `pnpm desktop:mac --x64` produces the selected Apple Silicon or Intel DMG file under dist/.
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

## Platform menus and shared interface
Desktop menus use Electron's native OS menu roles rather than HTML imitations. macOS uses the system menu bar: Made Mail (About, Services, Hide, Quit), File, Edit, View, Window, Help. Windows uses the window's File/Edit/View/Help menu with Alt-key mnemonics, File → Exit, and Help → About. Standard edit and window commands use platform keyboard shortcuts. Settings/account and mail commands will be added when their underlying features are available; no placeholder Settings command is exposed.

The shared renderer now uses a compact three-pane inbox, account/folder navigation, date-grouped rows, unread/flag indicators, density control, and a modal rules preview. Archive/Junk/Deleted Items and read/flag actions affect synthetic messages in memory only. Browser checks verified account filtering, search, empty states and rule matches. Native menu integration has automated platform-template tests; OS interaction acceptance remains pending.

Design references: https://support.apple.com/guide/mail/welcome/mac and https://support.microsoft.com/en-us/outlook/mail/change-how-the-message-list-is-displayed-in-outlook . Menu roles: https://www.electronjs.org/docs/latest/tutorial/application-menu .

## alpha.2 window and mailbox update
The desktop window explicitly requests the standard OS frame/title bar, visible Mac traffic lights, normal (not full-screen) startup, and a regular macOS application menu. View → Restore Standard Window (Command+Shift+0 on Mac, Ctrl+Shift+0 on Windows) exits full screen and restores window controls. Mac application menus are in the system menu bar at the top of the screen.

Mailbox → Empty Junk / Empty Deleted Items and right-click mailbox menus now open a confirmation showing the count and scope across the sample accounts. The mailbox also has a visible Empty button. Cancel/Escape leaves messages untouched; only the selected Junk or Deleted Items folder is emptied after confirmation, ignoring search filters. These are in-memory fictional messages, not provider operations.

A narrowly scoped preload bridge exposes only mailbox menu requests and fixed mailbox commands. Main-process requests validate the originating window, main frame, application origin and folder allowlist. There is no generic IPC or filesystem bridge. This supersedes the earlier description of having no preload/IPC. Native menu and traffic-light interaction on the user's laptop still needs confirmation after restarting this updated source.

## alpha.3 mailbox navigation and account menus
Work/Personal category sections are removed. Inboxes are identified by email address, with shared Sent, Projects, Archive, Junk and Deleted Items listed directly. All Inboxes remains available. The addresses are synthetic fixtures, not real connected accounts.

File → Add Account and Accounts are available in the native OS menu and in an always-visible in-window menu row. macOS also has Made Mail → Accounts. The entries open an honest account status dialog: OAuth/IMAP connection and credential storage are not implemented and no sign-in credentials are requested. Native commands use a one-way allowlisted preload event; no generic renderer-to-main account IPC exists. Browser checks verified the File entry opens the account dialog.

## Native menu convention correction
Electron now hides the HTML menu row entirely, leaving macOS's system menu bar or Windows's native per-window menu. The HTML row is only for browser use. macOS keeps About, Settings (Command-comma), Accounts, Add Account, Services, Hide and Quit in the Made Mail application menu; Windows keeps account setup/settings in File and About in Help. Settings currently opens the Accounts preview because real account configuration is not implemented. The app retains standard native window controls. This supersedes alpha.3's duplicate in-window desktop menu.

## Screenshot reference layout (alpha.4)
The supplied Outlook screenshot guides the default interface: gray search/title area, Home/View/Help command ribbon, email-address folder trees, denser avatar/sender/subject/date rows, and a right reading pane. The supplied Apple Mail screenshot guides View → Column view: compact From/Subject/Received rows with blue selection and no reading pane. View → Reading pane restores the Outlook-style layout. The native OS menu remains separate and the browser-only menu row remains hidden in Electron. This supersedes alpha.3's flat shared folder list in favor of the newly requested Outlook account-folder structure; no Work/Personal category labels are displayed.

Commands for sample archive/delete/junk/read/flag and rules are wired. New mail/reply/forward stay disabled because sending is not implemented. Account setup remains a preview notice, not a working OAuth flow. Emptying an account's Junk/Deleted Items is scoped to that account; native Mailbox menu commands still apply across sample accounts and the confirmation explains scope.

Browser visual checks verified both layouts, ribbon navigation and reading-pane restoration. Packaged smoke checks cover the desktop bridge, native-menu duplication prevention and layout switching; platform-native appearance remains subject to manual acceptance.

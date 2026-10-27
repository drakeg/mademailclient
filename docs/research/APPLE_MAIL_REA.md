# Apple Mail shipped-app inspection

Inspected 2026-10-27 using the connected REA tools against `/System/Applications/Mail.app`. This is a static inspection of the installed app and its bundled interface resources. Mail was not launched; no personal mail database, accounts, tokens, keychain records or network traffic were inspected. No Apple implementation code or visual assets are copied into Made Mail.

## Target identity and evidence

- App: Apple Mail, `com.apple.mail`, version 16.0, build `3901.100.1.1.12`.
- Executable: `/System/Applications/Mail.app/Contents/MacOS/Mail`.
- SHA-256: `9e1d4526c45462d3facdfe47e133c42d97ead0fd97229dfc6ef5a0eab2e44aec`.
- REA identified a universal Mach-O; native inspection selected `arm64e`. Plist metadata declares `MailApp` as the principal class and `MainMenu` as the main nib.
- Complete raw REA evidence is retained outside the repository under the task's `outputs/rea-mail-2026-10-27` directory (export completed: 11 Evidence records, 1,693,712 bytes). This report preserves the relevant evidence IDs and limits; a local bundle is not a portable copy of Apple's app.

| ID | REA Evidence | Source / scope |
|---|---|---|
| E1 | `ev_cca11f49db1b9de79c438d0fdfaafa021974558ff07f1c083b845cb3fd55bc29` | Info.plist: app identity, document types, URL handlers, principal class and main nib |
| E2 | `ev_977a28f60ca0448b15f9f26dee667ac7b125ae1e49f6a47f6bf1d58f47ef6ca5` | Mach-O inspection: selected slice, load commands and dependencies; imports/exports are not exhaustive |
| E3 | `ev_7209be7bf1deb0aa2d25f75b1b6861a41f8ec4e869f81798f71bee3183c4c620` | MainMenu.loctable, selected English labels |
| E4 | `ev_98d1f408796f2859c991b1b6da0068455968f272631c17edddf3d18c964d1454` | PreferencesWindow.loctable, selected English labels |
| E5 | `ev_d3aa914dfe714f9323cefc24c7b6ccbdfba92ae6534c45524451d71ff27553fe` | SMTPSettings.loctable, selected English labels |
| E6 | `ev_fb4371c5566dda24877f46919c233f389c68a34c117406d54cc684cc543b9cd0` | RulesPreferences.loctable, selected English labels |
| E7 | `ev_2a1126594f06addf10883c3eb92b54dce82566172c1d5bb882a72bca4982979f` | AccountInfo.loctable: account-information resource |
| E9 | `ev_d0221855e7f2e5dca827537774fb74ef3bc488e0394a12cc2c9a5c4f9ca95b9d` | Ghidra-defined strings matching account-management selectors; static names only |
| E8 | `ev_65151ac5d688c7b42ea229239395104bc928f5cfd2dd79ed6f0042a29e2f99a2` | MessageViewer.loctable inspection; no contextual command conclusion drawn from this table |

## Observations, inferences and Made Mail implications

| Topic | Observed in shipped artifact | Interpretation / limitation | Made Mail consequence |
|---|---|---|---|
| Native application structure | E1 names the main nib and native principal class; E2 links AppKit | Native AppKit participation is established; this does not recover every runtime view | Keep platform-native application menus and OS window controls, as already required by MENU_LAYOUT.md |
| Account commands | E3 includes account-addition and account-management command labels | Labels establish commands exist, not their exact parent-menu order or current visibility | Keep account setup in application/File menus; never reintroduce it into the folder sidebar |
| Message commands | E3 contains reply, reply-all, forwarding, attachment forwarding, and junk-movement labels | Resource presence does not prove which commands are enabled for a particular selection | Preserve context/capability-aware reader actions and the Message menu; make live operations real before presenting them as available |
| Settings organization | E4 distinguishes account information, server settings and a rules section | Separate settings concepts are observed; exact tab/widget hierarchy requires nib decoding or runtime confirmation | A future unified Settings window should separate Accounts, Server Settings and Rules; retain the user's preference for Outlook-style rule editing |
| Automatic server configuration | E4 and E5 include an automatic connection-settings control | Its label does not reveal the discovery algorithm or prove a particular provider uses it | Keep provider-first setup and hidden advanced fields; treat discovery and login verification as distinct operations |
| SMTP configuration | E5 has server-name, authentication and server-settings resources | These are static settings labels, not proof of SMTP behavior or password handling | Preserve separate outgoing configuration and explicit test results; do not call a saved SMTP configuration a working send feature |
| Layout variants | Bundled resources include message-list column and list-layout controllers, plus MessageViewer and conversation resources | File identities indicate separate interface resources; exact sizing and runtime composition are not recovered | Retain the three-pane workspace and optional column layout, with folder-only navigation |
| Rules | E6 contains reply/forward actions and a stop-evaluating-rules control | No rule execution or evaluation algorithm was observed | Expand Made Mail's subject-only rule UI around the existing pure planner, using Outlook-like conditions/exceptions and previews rather than copying Mail's editor |
| OS account integration | E2 directly links Accounts, AccountsDaemon, AccountsUI, AccountsUISettings, AppleAccount and AuthKit frameworks; several paths are under PrivateFrameworks | This supports an inference that Mail participates in Apple's account/authentication stack. Linking alone does not prove the exact Google/Yahoo authorization flow or credential ownership | Use supported cross-platform OAuth in Made Mail. This inspection provides neither app registrations nor permission to reuse Apple's provider identity, private services or credentials |

## Focused native account-management observation

REA's Ghidra 12.1.4 provider completed its default auto-analysis and found the following defined strings (E9):

| Address | Observed selector/name |
|---|---|
| `0x1004ecac0` | `addAccount:` |
| `0x10050f3c4` | `openSystemAccountPreferences:` |
| `0x100529b77` | `showAddAccountSheetInWindow:cancelWillQuit:completionHandler:` |

These names strengthen the account-sheet/system-settings interpretation, but no call graph, function pseudocode or runtime invocation was inspected. They do not establish which path handles Google or Yahoo, or permit treating Apple's system account identities as Made Mail credentials. REA reports that only defined string Data is covered; undefined or packed strings may be absent. The ephemeral Ghidra project was closed and cleaned up after evidence export.

## Comparison with Made Mail at commit 8463976

Normal repository inspection, not REA, establishes the following Made Mail facts:

- Native menus and folder-only sidebar are implemented (`apps/desktop/menu.cjs`, `apps/web/app.mjs`). The user's requested placement already follows the useful high-level structure observed here.
- Provider selection, simplified app-password forms and expandable manual settings are implemented (`apps/web/account-setup.mjs`).
- Browser authorization code exists, but public builds have no configured Google/Yahoo registrations and cannot complete provider login (`docs/PROVIDER_SIGN_IN.md`). Mail's packaged resources do not remove this blocker.
- The app reads recent inbox messages only. Reader mutations and reply/forward remain disabled on connected accounts. Demo movement is not a substitute for a provider adapter.
- Rules are preview-only, with a subject-only editor despite a richer pure planning engine. Mail's resources provide useful vocabulary, not execution code or proof of behavior.

## Ordered follow-up

1. Complete Made Mail's own provider registrations and disposable-account consent/refresh acceptance. This directly addresses the current request for easier Gmail/Yahoo login.
2. Implement read-only server folder discovery and folder reading, then explicit account-scoped provider actions with capability checks. Keep Junk/Not Junk account-preserving and Delete routed to Deleted Items.
3. Complete compose/reply/reply-all/forward with correct sender selection and failure/duplicate-send handling.
4. Introduce a proper Settings window with accounts, server settings and rules sections, preserving native menu entry points.
5. Improve the rule editor using the user's Outlook preference, with ordered conditions, exceptions, stop processing and previews.
6. Use a controlled runtime comparison to verify menu order, shortcuts, selection states, window sizing and provider-dialog transitions. Use synthetic/empty accounts to avoid mixing personal mail into evidence.

## Coverage and unknowns

The current evidence is static. No Google/Yahoo sign-in, rule execution, junk filtering, mailbox mutation, rendering timing or account migration was executed. Localized strings may include legacy or unused labels. They do not establish exact menu hierarchy, state, keyboard shortcuts or visible layout. An `ibtool` lookup failed because that tool is not installed, so compiled nib hierarchy was not decoded. Native imports/exports are incomplete by the REA provider's own limits. Resource-path inventory is from an ordinary file listing and is distinguished from REA analysis.

Outlook is not required to act on the observed gaps. A later Outlook comparison would be useful specifically for Windows conventions and the rule editor. Its web version can inform interaction design but cannot establish native Windows menus, installers, shortcuts or OS integration.

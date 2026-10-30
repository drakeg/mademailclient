# Agile delivery plan

## Product goal and scope
One client for existing personal/work email across Mac, Windows and web, with unified/account inboxes and understandable Outlook-style rules. No mailbox hosting, calendar, contacts, tasks, or new addresses in the first release. Provider coverage is incremental and subject to provider consent and organizational policies.

## Priority correction: desktop first

Mac and Windows installable apps are the primary deliverables. Hosted web access follows desktop alpha. Shared browser UI work supports the desktop renderer; it is not the first release channel. Initial sequencing below is superseded by: desktop packaging → native install/launch acceptance → first-provider desktop alpha → rules and multi-account desktop beta → signed desktop release → hosted web.

| ID | Immediate desktop story | Acceptance | Status |
|---|---|---|---|
| X00 | Bundled desktop shell and DMG/EXE builds | No server needed; sandboxed renderer; Mac/Windows artifact workflow | Implemented; Mac app bundles built, DMG and Windows validation pending |
| X02 | Native installer acceptance | Install, launch, close/reopen, uninstall on Mac Intel/ARM and Windows x64 | Next |
| X03 | Trusted distribution | Signed Windows app, signed/notarized Mac app, verified update strategy | Backlog |

## Delivery process
Use two-week iterations as planning units, not date commitments. The repository owner initially acts as product owner and maintainer; contributors volunteer for stories during planning. No team capacity or delivery date is assumed. Product owner prioritizes; implementer estimates; a maintainer other than the implementer reviews when available.

Board columns: Backlog → Ready → In progress → Review → Done; Blocked records cause, owner and next action. Limit each contributor to one active story. The table below is the initial source of truth; GitHub Issues/Projects have not yet been populated. When migrated, retain story IDs and link issues here.

Cadence: planning selects an iteration goal and capacity; async check-ins report progress/blockers; refinement splits unclear work; review demonstrates acceptance criteria; retrospective records one process improvement. Reprioritize after each provider spike and user review.

Definition of Ready: problem and user outcome clear, acceptance criteria testable, dependencies identified, security/provider assumptions documented, story small enough for one iteration. Definition of Done: behavior implemented, relevant automated/manual checks recorded, review complete, CI passing, docs updated, no undisclosed mocks or critical security defects. A local implementation pending review is not Done.

## Initial backlog
Points are rough relative estimates (1, 2, 3, 5, 8); split larger stories after discovery. P0 blocks safe MVP; P1 required for release; P2 follows beta. All owners are unassigned unless noted.

| ID | Epic / story | Priority / points | Dependencies | Acceptance criteria | Status |
|---|---|---|---|---|---|
| F01 | Contributor-ready foundation | P0 / 3 | None | README, agent guide, contribution policy, CI, plan and architecture committed; checks run | Implemented; review pending |
| F02 | Synthetic inbox and rule preview | P0 / 5 | F01 | All/personal/work views, search, reader; five required actions preview without mutation | Implemented; review pending |
| F03 | Deterministic rule planner | P0 / 5 | F01 | All/any, exceptions, scope, order, stop processing tested | Implemented; review pending |
| D01 | Provider capability spike | P0 / 3 | F01 | Verify official Graph/Gmail/IMAP docs, scopes, work-account restrictions, Junk/Trash/delete/reply semantics; record matrix and choose first provider | Ready |
| D02 | Backend and desktop decisions | P0 / 3 | F01 | ADRs compare identity, storage, durable jobs, key management, Tauri/Electron; specify hosted/self-hosted boundaries | Backlog |
| A01 | Identity and tenant isolation | P0 / 8 | D02 | Sign in/out, session protection, per-user account access and adversarial isolation tests | Backlog |
| A02 | First provider connection | P0 / 8 | D01,A01 | Consent, encrypted token storage/refresh, denied consent and disconnect tested; no token leaks | Backlog |
| S01 | Incremental mailbox synchronization | P0 / 8 | A02,D02 | Initial and incremental sync, stable IDs, folder mapping, retries, deduplication and expired cursor recovery tested | Backlog |
| U01 | Live unified inbox | P0 / 5 | S01 | Multiple accounts combine without ID collisions; account/folder filtering and pagination; accessible loading/error/empty states | Backlog |
| U02 | Compose and reply | P1 / 8 | A02,U01 | Correct sending account by default; drafts, attachments, send failure recovery and duplicate-send prevention | Backlog |
| R01 | Persistent rule editor | P0 / 8 | A01,F03 | All/any conditions, exceptions, account/global scope, reorder, enable/disable, stop processing and template validation; persistence tested | Backlog |
| R02 | Folder/Junk/Trash executor | P0 / 8 | S01,R01 | Provider folder IDs and capabilities enforced; durable execution deduplication; partial failure audit; no destructive fallback | Backlog |
| R03 | Permanent deletion | P0 / 5 | R02 | Distinct opt-in, preview, capability recheck and audit; ambiguous retry reconciled; unsupported provider fails visibly | Backlog |
| R04 | Automatic responses | P0 / 8 | R02,U02 | Template support; header/list/bounce/self loop suppression; durable sender cooldown and duplicate prevention across workers | Backlog |
| R05 | Retroactive rules and audit | P1 / 5 | R02,R03,R04 | Preview snapshot, scoped run, progress/cancel, per-message explanation and retry-safe outcomes | Backlog |
| P01 | Additional providers | P1 / 8 each | D01,S01,R02 | Repeat connection/sync/action contract suite for Microsoft, Gmail and IMAP/SMTP; document unsupported capabilities | Backlog |
| H01 | Hosted and self-hosted beta | P1 / 8 | A01,S01,R05 | Deployment runbook, secrets, migration, backups/restore, retention/deletion, observability and staging recovery rehearsal | Backlog |
| X01 | Mac and Windows shells | P1 / 8 | D02,U02 | Builds established in X00; signing/notarization, secure auth handoff, credential storage, update checks and installer smoke tests pending | Backlog |
| Q01 | Release hardening | P1 / 8 | H01,X01,P01 | Keyboard/screen-reader testing, safe HTML/attachments, security review, performance budgets and full account lifecycle acceptance | Backlog |
| O01 | Offline cache and queued actions | P2 / 8 | X01,Q01 | Encryption, cache purge, conflict and reconnect semantics documented/tested before mutations | Backlog |

## Iteration goals and milestones
- Iteration 0, foundation: F01–F03; delivered locally for review. Exit: CI verified on GitHub and maintainer review.
- Iteration 1, desktop priority: X00–X02, then D01–D02 and refine/split A01–A02. Exit: provider matrix and accepted architecture decisions.
- Subsequent iterations: identity/connection → sync/live inbox → compose/rules → safe execution/audit → provider breadth → desktop hardening → hosted web. Select stories within actual capacity; no promise that each group fits one iteration.
- M1: contributor prototype (F01–F03 reviewed).
- M2: one-provider private alpha (A01–A02,S01,U01,U02,R01–R05).
- M3: multi-provider desktop beta (P01,X01 plus security gates).
- M4: trusted desktop release, then hosted web beta (H01); offline follows separately.

## Risks and validation
Provider limits and organizational consent may restrict accounts: validate in D01 before committing support. Duplicate events can cause destructive repeats: durable idempotency and ambiguous-outcome tests block execution release. Token compromise and tenant leaks block alpha. Desktop signing and hosting costs need owner decisions before distribution. Large mailbox performance requires a synthetic benchmark and agreed budget during S01 refinement.

Track iteration completion versus commitment, escaped defects, blocked time, sync lag and rule failures; establish targets from alpha measurements. Do not collect mail content for metrics. Review real-user workflow with synthetic examples at each milestone.

## Alpha release pipeline progress

Release automation now builds Mac arm64, Mac x64 and Windows x64 on matching GitHub runners, performs packaged-app smoke tests and creates draft alpha releases with checksums only after all targets pass. Initial platform validation passed: https://github.com/drakeg/mademailclient/actions/runs/39837289663 . Native menu interaction, installer acceptance and trusted signing remain open gates; see releases/alpha-acceptance.md and TESTING.md. No public release is approved by these automated checks alone.

## Desktop usability follow-up
alpha.2 adds explicit native window framing and recovery, a Mailbox menu, context actions for Junk/Deleted Items and counted confirmations. Browser manual checks verified right-click action selection and cancel preserving messages. Unit tests cover folder scope, IPC rejection and menu dispatch; native interactions still need platform verification. No alpha.2 installer release has been published.

## Account lifecycle increment (2026-10-23)

| Story | Status / next acceptance |
|---|---|
| A02a GUI add/remove with encrypted desktop vault | Implemented; OS credential persistence and real-provider acceptance pending |
| S01a Recent IMAP inbox reads | Implemented: 30 per account, bounded text preview; protocol fixtures tested, live-provider acceptance pending |
| U01a Empty startup and unified/account inbox UI | Implemented; pagination and full folder synchronization remain backlog |
| A02b Microsoft/Google OAuth | Next: registrations, PKCE, scope/consent and refresh design |
| X03 trusted installers | Blocked on signing identities; existing release gate retained |

Full A02/S01/U01 acceptance is not complete. See ACCOUNTS.md for support and evidence limits. Account removal never removes remote mail.

## SMTP and automatic setup increment (2026-10-26)

| Story | Acceptance | Status |
|---|---|---|
| A02c Incoming/outgoing settings | IMAP and SMTP host/port/security; shared or separate credentials; both verified before save; edit existing accounts without removal | Implemented; provider/OS credential acceptance pending |
| A02d Automatic setup | Built-in presets and domain SRV lookup; source and auth guidance; manual fallback and overrides; no credential probing | Implemented; custom-domain breadth remains limited to supported SRV records |
| U02 Compose/send | Sending account selection, drafts, attachments and duplicate-send recovery | Backlog; SMTP verification does not complete this story |

See ACCOUNT_SETUP_PLAN.md and ACCOUNTS.md for the contract, security boundaries, source references and remaining acceptance work.

## Native menus and folder-only sidebar

Menu placement is now a standing UI requirement: account setup in application/File menus, Rules in Mailbox, selected-message actions in Message and the right reading pane. The sidebar contains mailbox navigation only; the command ribbon is removed. Contextual Junk/Not Junk movement is implemented for sample data and tested; live mutations and sending remain backlog. See MENU_LAYOUT.md for acceptance and capability limits.

## Easier Gmail/Yahoo connection

Provider selection and simple app-password forms are implemented. Google/Yahoo native Authorization Code + PKCE, encrypted tokens, refresh, identity-safe reconnect and platform callback wiring are implemented with synthetic tests. Publisher registrations are missing (owner confirmed); Yahoo mail access approval, Google consent/verification, and live-platform/provider acceptance remain open. A02b is therefore implemented pending external registration and acceptance, not Done. See PROVIDER_SIGN_IN.md for setup and evidence limits.

## Apple Mail reference investigation (2026-10-27)

REA static inspection of installed Mail 16.0 is complete and documented in [research/APPLE_MAIL_REA.md](research/APPLE_MAIL_REA.md), with target hashes, Evidence IDs, source-bound observations and explicit unknowns. It confirms useful settings/message-command concepts and provides evidence of system account integration, without recovering provider credentials or eliminating publisher registration requirements. Use the ordered follow-up in the report: provider acceptance, live folders/actions, compose, unified Settings, then the Outlook-style rule editor. Native runtime behavior and exact menu hierarchy remain unverified.

## Installer delivery follow-up (2026-10-27)

Linux x64 AppImage/DEB joins the Mac ARM/Intel DMG and Windows x64 NSIS EXE build matrix. A local macOS source-build/install script packages, smoke-tests and copies to /Applications without retaining the previous bundle. See [INSTALLERS.md](INSTALLERS.md). X02 still requires real installation/upgrade/uninstall acceptance on each platform; X03 Mac distribution remains blocked on Developer ID/notarization. Linux CI runtime validation is tracked separately from DEB/AppImage installation acceptance.

## Usable mail milestone (2026-10-29)

Alpha.5 implements S01b/U01b real folder listing, 50-message pages and minute polling; U02a plain-text compose/reply/reply-all/forward and SMTP; U02b encrypted local drafts and durable submission status. Tests use synthetic messages/clients only. Full U02 remains incomplete: attachments, server drafts and real-provider/OS acceptance are open. R02 live mutations and offline cache remain backlog. See SEND_RECEIVE.md.

At the owner's request, major milestones will have versioned GitHub preview downloads. Windows/Linux publication requires a successful four-platform installer run for the exact source SHA. Mac downloads remain excluded until signing/notarization and downloaded-install acceptance are available. The legacy alpha.1 publication workflow is replaced; it cannot accidentally republish the broken old Mac download.

## 0.2.0 usable mailbox increment (2026-10-29)

R01a implements saved account-scoped ordered rules, all/any conditions, exceptions, enabled state and stop processing. R02a implements live IMAP MOVE-to-folder/Junk/Trash and absolute flags, durable operation claims/deduplication and action history. R05a adds single-use preview/apply for the recent inbox page. S01c adds rule catch-up and prospective cursors. These are implemented with synthetic validation; provider/OS acceptance remains open, so full R01/R02/R05 are not marked Done. R03 permanent purge and R04 automatic replies remain blocked on their safety/execution work.

Mailbox → Folder Settings persists explicit role mappings. Account vault format, profile location and app ID remain unchanged across this upgrade. See MAIL_WORKFLOWS.md and the 0.2.0 release notes for precise limits and acceptance evidence. Version 0.2.0 replaces sample-only controls; its GitHub prerelease status remains until real-platform/provider acceptance, independent of the version label.

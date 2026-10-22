# Agile delivery plan

## Product goal and scope
One client for existing personal/work email across Mac, Windows and web, with unified/account inboxes and understandable Outlook-style rules. No mailbox hosting, calendar, contacts, tasks, or new addresses in the first release. Provider coverage is incremental and subject to provider consent and organizational policies.

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
| X01 | Mac and Windows shells | P1 / 8 | D02,U02 | Signed/notarized installation where applicable, secure auth handoff, credential storage, update checks and installer smoke tests | Backlog |
| Q01 | Release hardening | P1 / 8 | H01,X01,P01 | Keyboard/screen-reader testing, safe HTML/attachments, security review, performance budgets and full account lifecycle acceptance | Backlog |
| O01 | Offline cache and queued actions | P2 / 8 | X01,Q01 | Encryption, cache purge, conflict and reconnect semantics documented/tested before mutations | Backlog |

## Iteration goals and milestones
- Iteration 0, foundation: F01–F03; delivered locally for review. Exit: CI verified on GitHub and maintainer review.
- Iteration 1, decisions: D01–D02 and refine/split A01–A02. Exit: provider matrix and accepted architecture decisions.
- Subsequent iterations: identity/connection → sync/live inbox → compose/rules → safe execution/audit → provider breadth → hosting/desktop → hardening. Select stories within actual capacity; no promise that each group fits one iteration.
- M1: contributor prototype (F01–F03 reviewed).
- M2: one-provider private alpha (A01–A02,S01,U01,U02,R01–R05).
- M3: multi-provider web beta (P01,H01 plus security gates).
- M4: cross-platform public beta (X01,Q01); offline follows separately.

## Risks and validation
Provider limits and organizational consent may restrict accounts: validate in D01 before committing support. Duplicate events can cause destructive repeats: durable idempotency and ambiguous-outcome tests block execution release. Token compromise and tenant leaks block alpha. Desktop signing and hosting costs need owner decisions before distribution. Large mailbox performance requires a synthetic benchmark and agreed budget during S01 refinement.

Track iteration completion versus commitment, escaped defects, blocked time, sync lag and rule failures; establish targets from alpha measurements. Do not collect mail content for metrics. Review real-user workflow with synthetic examples at each milestone.

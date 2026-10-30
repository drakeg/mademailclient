# Mail workflows in 0.2.1

This release replaces sample-only mailbox controls and preview-only rules with working IMAP actions and persisted rules. SMTP compose/reply/forward is retained. The app remains an original Electron email client; no Outlook or Apple Mail code/assets are copied.

## Everyday use

Add and edit accounts through Made Mail/File → Accounts. Incoming/outgoing server settings and credentials are retained in the OS-encrypted account vault across launches and installer updates. Mailbox → Folder Settings saves explicit Trash/Junk/Archive mappings for providers that do not advertise special-use folders. Nothing guesses a destination by a localized folder name.

Select a message to load its plain-text body and mark it read. The reader and native Message menu support Reply, Reply All, Forward, Move to Folder, Archive, Delete, Junk/Not Junk, read/unread and flags for writable accounts. Delete moves to Trash; it cannot turn into permanent deletion. A message in Junk offers Not Junk, which moves it to the same account's Inbox. Moving to Junk does not promise provider-specific spam training. SMTP forwarding quotes loaded text; attachments are not forwarded yet.

The main process now uses bounded account request queues instead of rejecting requests whenever another operation is active. Reads allow three concurrent tasks with pending message-body requests prioritized; settings changes remain serialized; discovery has a separate two-task queue. Authorization is checked both before enqueueing and before executing. Each queue caps active plus pending requests at 100. Failed tasks release their slots. This queues each original request once; it does not retry a failed mail mutation. Confirmed read/flag changes are overlaid until server metadata acknowledges them, and loaded bodies survive metadata refreshes for unchanged message IDs. Changing account identity/server settings invalidates cached bodies. A message is marked read on an explicit selection; manual Mark as Unread is preserved until it is selected again. Body previews remain bounded to 2 MB of source and 200,000 text characters. Mail bodies are not cached across app restarts.

## Rules

Mailbox → Rules lists saved rules. Create/edit, enable/disable, order, and delete them there. Each rule belongs to one account and supports all/any subject, sender-email and recipient conditions; exceptions; stop processing; and one move, Junk, Trash, mark-read, mark-unread or flag action. To perform a flag followed by a move, use two rules and disable stop processing on the first. A move always ends actions for that source UID because it is no longer in the source folder.

Save first. Preview evaluates saved enabled rules against up to 50 recent inbox messages and shows the matching subjects. Apply executes that single-use five-minute preview only if rule versions/order have not changed. It rechecks source UIDVALIDITY and message existence before each action. Repeated application of the same rule revision to the same source UID is deduplicated. Review failed/unknown operations before editing a rule to deliberately create another revision.

Enabled rules run for newly received inbox messages while the app is open and polling. The first observation after installation or UIDVALIDITY change establishes a baseline and does not retroactively modify existing mail. Later polls catch up through older envelope pages, up to 5,000 messages per catch-up. If the backlog exceeds that bound, processing stops visibly. Disabling rules and refreshing establishes a new baseline; review older mail manually. There is no closed-app/cloud rule worker. Changes to rules during execution stop the old snapshot from continuing on subsequent messages.

Permanent-delete and automatic-response rules are not exposed in this executor. The pure planner's wider schema does not imply those operations are implemented. Automatic replies still require durable cooldown and loop prevention; emptying Trash permanently is not implemented. Existing recent mail changes only through explicit Preview → Apply, not merely saving a rule.

## Safety and persistence

All mutations reauthorize the saved account and use the existing DNS-pinned TLS connection boundary. Read-only Yahoo OAuth cannot mutate mail or execute rules; an app-password account may be used where the provider allows it. MOVE must be advertised by the server: there is no COPY/delete fallback. Folder mapping values must belong to the same account and be selectable. No missing Trash/Junk capability can cause permanent deletion. Flags use explicit add/remove operations, not toggles.

Each action is claimed in an encrypted on-disk journal before connection/submission and recorded done, failed-before-submission, or unknown. Interrupted pending records become unknown. A reused request ID never repeats a server operation, and rules derive stable action keys from account, source folder, UIDVALIDITY, UID, rule ID and revision. Unknown outcomes are never automatically retried. Inspect Mailbox → Action History and the provider before requesting another manual action. History shows the last 200 records and retains up to 100,000 records before stopping rather than silently losing deduplication history.

`accounts.enc`, `folder-settings.enc`, `rules.enc`, `rule-cursors.enc`, `mail-actions.enc` and `outgoing.enc` reside in Electron's existing userData profile and use OS encryption/atomic 0600 writes. Existing account storage/path/app ID are unchanged. Rules are capped at 500, with 20 conditions and 20 exceptions per rule. Removing an account or uninstalling does not automatically purge other encrypted local records; no remote mail is deleted by account removal.

## Validation and remaining limits

Automated checks use synthetic accounts/messages only. Adapter tests cover Trash-only deletion, missing MOVE/special folders, stale UIDVALIDITY, ambiguous MOVE, flags, saved mappings and IPC isolation. Rule tests cover persistence, prospective baselines, catch-up, stale/single-use previews and rejection of permanent-delete/auto-reply actions. Browser checks use the real action/rule services backed by an in-memory simulated mailbox; they verify read, Delete, Junk/Not Junk, save/reload/preview/apply rules, and forwarding. Packaged smoke tests additionally exercise the rule and folder-setting interfaces with injected synthetic services.

These checks do not claim Gmail, Yahoo, iCloud or Microsoft-specific acceptance. Real providers, OS credential persistence, clean installation/upgrade and network interruption behavior still need user/disposable-account acceptance. Attachments, server-synced drafts, offline mail cache, full-server search, permanent purge, automatic replies, and provider OAuth registration remain open work. Windows/Linux downloads are published on GitHub; trusted downloadable Mac distribution remains blocked on Developer ID/notarization, so local source installation remains the Mac path.

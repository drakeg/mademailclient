# Empty Junk and Deleted Items

Implementation under review; not included in the published 0.4.1 installers.

Use **Mailbox → Empty Junk… / Empty Deleted Items…**, or right-click that account’s mapped/special-use folder and choose Empty. A global command uses the selected account or asks which account; it never silently empties every account. Folder Settings selects nonstandard Junk/Trash paths. Inbox is always refused.

The native confirmation names the account, server folder and exact snapshot count. Cancel is the default. Permanent deletion cannot be undone. Search, unread filters and currently loaded pages do not limit the snapshot. New arrivals are excluded. No content is downloaded to prepare the count.

## Execution contract

- The main process resolves the role from saved mappings/server special-use attributes. The renderer cannot supply a deletion path, UID set or approval token.
- Confirmations expire after five minutes and are consumed once. Account identity, folder mapping and UIDVALIDITY are checked again after confirmation. Read-only authorization/folders are refused.
- At most 5,000 messages per confirmation; larger folders are refused before mutation. Commands use batches of 500.
- UIDPLUS is required. Explicit UID STORE marks only snapshot UIDs Deleted; explicit UID EXPUNGE purges only those IDs. There is no broad EXPUNGE/CLOSE or COPY/delete fallback, including after capability loss.
- A pending operation is saved to OS-encrypted `mailbox-empty.enc` before any mutation. Completed, failed and uncertain operations appear in Mailbox → Action History. Pending records become unknown on restart. Interrupted/ambiguous operations are never automatically retried. Some messages may already have been removed or marked Deleted: refresh and inspect the provider before starting another operation.
- No change to Delete-to-Trash, rules or automatic replies. Browser demo emptying remains fictional and resets on reload.

## Evidence and limits

Synthetic tests cover cancellation, IPC origin, snapshot preservation, replay/expiry, mapping/identity changes, read-only access, missing UIDPLUS, failure journaling and bounds. A real loopback IMAP fixture verifies the pinned ImapFlow transport emits `UID EXPUNGE` with explicit UIDs. Packaged smoke checks use invented mail only. No real account or private message is used. Real-provider and clean-install acceptance remain pending.

This implementation was authored for Made Mail. No Mailcraft code or assets were copied or incorporated.

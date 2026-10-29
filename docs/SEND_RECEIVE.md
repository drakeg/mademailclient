# Send/receive milestone contract

The alpha.5 desktop increment adds live folder browsing, polling and plain-text SMTP composition. Account setup remains native-menu driven. No real mail is used in automated checks or sent by the agent.

## Receive
Folder listing excludes non-selectable folders and displays the server path/name without guessing special-use destinations. Each read takes a read-only mailbox lock. Listing pages contain up to 50 envelopes; account-folder views can load older pages. IDs include account, folder, UIDVALIDITY and UID, so equal UIDs in different folders cannot collide. A UIDVALIDITY mismatch refuses stale bodies/pages. Bodies retain the existing bounded MIME-to-text handling. Polling runs every 60 seconds while the app is open, idle and without an open dialog. Failed refreshes preserve previously loaded mail. There is no durable mail cache, IMAP IDLE or closed-app background receive.

## Compose and submission
File → New Message creates plain-text mail. Reply and Reply All select the original account; Reply-To is honored, the account address is excluded from reply-all recipients, and forward quotes text only. Review recipients before sending. Addresses are plain comma-separated ASCII email addresses; display-name syntax is deliberately rejected in this increment. To is required for Send; empty recipients may be saved as a local draft. No HTML, attachments, arbitrary headers, URLs or filesystem paths are accepted from the renderer.

The main process binds From and SMTP credentials to the saved account, reuses DNS-pinned TLS transport validation and rejects read-only OAuth sending. The MIME builder removes Bcc headers while the SMTP envelope includes Bcc recipients. Only Google OAuth has a sending grant in the current configuration; Yahoo OAuth remains read-only. OAuth registration/real consent acceptance is still external work.

`outgoing.enc` uses the same OS-encrypted, serialized atomic-file vault mechanism as account credentials, with separate content. Draft and submission records are capped at 200 and retained until explicitly removed. They contain recipients, subject and body, not account passwords/tokens. Local drafts are not synchronized to server Drafts. Removing an account does not delete local outgoing records; users may remove them explicitly through the status window. A profile backup may also contain encrypted records; no remote telemetry is introduced.

Submission states: draft → persisted sending → accepted or unknown. Concurrent sends are rejected. Draft revision is checked atomically before submission to prevent a race with edits/removal. Any interrupted persisted sending record is treated as unknown on restart. No SMTP retry is automatic, including when the Sent-folder append fails. A server acceptance record is persisted before Sent append; the app uses only the server's special-use Sent folder and skips Gmail's provider-managed copy. There is no append retry for an ambiguous copy, avoiding duplicate copies. SMTP acceptance does not guarantee final delivery.

## Remaining acceptance
Use disposable accounts to test add/restart, receive, folder navigation, reply/reply-all (including Reply-To and self exclusion), forward, SMTP submission, Sent copy, partial rejection and disconnects on each OS. Confirm native menus, OS encryption, install/upgrade and account retention. Synthetic protocol and renderer smoke checks are evidence of implementation, not real-provider acceptance. Sending attachments, server drafts, live mutations, offline cache and broader providers remain planned.

Implementation references: https://nodemailer.com/message , https://nodemailer.com/smtp/envelope , https://imapflow.com/docs/api/imapflow-client/ .

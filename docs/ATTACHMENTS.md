# Received attachments (0.3.0)

Open a connected message to load its text and attachment list. Each attachment shows its filename, media type and decoded size. **Save As…** opens the native OS save dialog. Files are saved only when you choose a destination; Made Mail never opens or executes them. Inline MIME images are listed as files, not loaded into the reading pane. Version 0.4.0 also supports outgoing attachments and forwarding, described below.

## Limits and persistence

A message source can be at most 25 MiB, with at most 100 attachments. Individual saved attachments can be at most 20 MiB. These binary limits are labeled MB in the interface. Text is limited to 200,000 characters; HTML-to-text conversion is bounded to 1 MiB of HTML. Larger messages fail clearly without marking them Read from a failed load. Mail remains on the provider. Message text and attachment metadata are held in renderer memory; decoded attachment bytes remain in the main process during parsing/saving and are not cached on disk by the client. Explicitly saved files remain wherever you selected until you remove them.

Saving refetches the message, so it needs a connection. A moved/deleted message or changed UIDVALIDITY requires refreshing the folder. Previously displayed content is retained through a metadata refresh for the same stable message identity. OS encryption/profile paths for accounts, rules and drafts are unchanged.

## Security boundary

The fixed `accounts:content` API uses the saved account and a read-only mailbox lock, reuses pinned TLS transport, and fetches a bounded full source. It validates the source size before and after download, rejects incomplete sources, parses MIME with the existing mailparser dependency, and returns text/metadata only. No HTML, attachment byte buffers, tokens or filesystem paths are exposed through this response.

The fixed `attachments:save` API accepts account/folder/UID/UIDVALIDITY, attachment index and SHA-256 digest. It rechecks the current top-level renderer before queued work, before showing the dialog and after it closes. It resolves the saved account, refetches and verifies the selected bytes, then obtains a destination exclusively from Electron's native `showSaveDialog`. A renderer-supplied filename or destination is ignored. Attachment names are stripped of directory prefixes, control/bidi characters and Windows-invalid characters, bounded in UTF-8 bytes, and normalized for reserved device names.

File creation is exclusive, mode 0600 where supported. **An existing file or symlink is refused**, even if the OS dialog offers replacement: choose a new name. The service never deletes/replaces files as a fallback, runs a shell command, automatically retries a failed save, or opens the result. A filesystem error may leave a partial newly created file; inspect/remove that file manually before saving under the same name again. No malware scanner is included. Attached messages are saved as files; nested attachments are not extracted recursively.

## Validation and acceptance

Synthetic MIME tests verify exact binary decoding, metadata redaction, size/truncation/missing-message handling, stale mailbox identity, path/device-name sanitization, canceled/unauthorized/closed-window requests, digest mismatch, exclusive creation and symlink protection. Refresh reconciliation tests keep attachment metadata with loaded text. Packaged checks exercise the MIME parser and attachment UI from ASAR. Browser testing uses fictional messages, verifies actual bytes written to an isolated temporary fixture directory, keyboard activation, refresh retention, existing-file refusal and console output.

The browser fixture replaces the native picker with a temporary destination. Native save dialogs and real-provider download/refresh behavior on each target OS still require acceptance with disposable accounts. These checks do not claim real-provider acceptance. No personal mailbox was opened or altered by the agent.

References: [Electron save dialog](https://www.electronjs.org/docs/latest/api/dialog), [MailParser](https://nodemailer.com/extras/mailparser), [ImapFlow fetch](https://imapflow.com/docs/api/imapflow-client/).

## Sending and forwarding (0.4.0)

Use **Attach Files…** in the compose dialog for new mail, replies and forwards. The native picker selects regular files; the main process reads a bounded snapshot. Review the filenames and use Remove for individual files before sending. Limit: 10 attachments totaling 10 MiB (shown as MB); MIME/base64 overhead increases the transmitted size, and a provider may impose a smaller limit. Folders/special files and files that change while being read are refused. There is no drag/drop, clipboard attachment or attachment editing.

Attachments are copied into the OS-encrypted outgoing.enc journal as base64 bytes with a SHA-256 digest, not references to their original paths. Editing/removing an original file later does not change a saved draft. Reopening a local draft restores its attachments. The renderer receives filename/size/type/ID/digest metadata, never file bytes or original local paths. Composer saves ignore renderer-supplied attachment/path data; only fixed native-picker or validated incoming-message import methods add bytes. Local attachment storage is capped at 40 MiB across drafts and submission records. Remove attachments from editable drafts or remove old local records to free space. Accepted/unknown submission records retain their files until explicitly removed. No server Drafts synchronization is added.

Forward automatically imports the original attachments using the original account/folder/UID/UIDVALIDITY and expected SHA-256 digests. Import intent is saved before retrieval. Failed/stale/oversized imports keep a durable pending marker that blocks Send across saves/restarts. Retry original attachments, or explicitly choose **Forward text only** to remove that requirement. Adding unrelated files cannot clear it. Replies start without original attachments; files can be added through the picker.

Concurrent file imports recheck draft revision and requester authorization before persistence. Submission freezes the persisted draft revision, builds MIME using only stored byte buffers (filesystem/URL access disabled), and retains the existing sending → accepted/unknown state machine. No failed or ambiguous send is retried automatically. The Sent copy uses the exact submitted MIME, including attachments. Bcc is excluded from MIME headers.

Tests cover exact binary MIME content, draft restart, metadata-only IPC, bounds, invalid files, closed/unauthorized requesters, competing draft edits, storage caps, durable failed-forward blocking and explicit text-only resolution. A browser fixture exercises forward/add/save/reopen/send using actual services and MIME generation, with a local capture transport and native-picker stand-in. Real provider and native picker acceptance on each OS remains pending.

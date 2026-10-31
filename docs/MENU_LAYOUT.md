# 0.3.0 received attachments

Received attachment rows and Save As belong in the reading pane. Save As uses the OS native file dialog; it adds no sidebar command or utility menu. Forward continues to include text only. See [ATTACHMENTS.md](ATTACHMENTS.md).

# Current 0.2.0 menu and mailbox contract

The desktop uses native OS menus; the browser uses a top menu. Accounts belong in Made Mail/File, Rules and Folder Settings/Action History in Mailbox, and selected-message actions in Message/the reader. The sidebar contains folder navigation only.

Connected writable accounts now support Move, Delete-to-Trash, Junk/Not Junk, Archive, read/unread and flags. Reply/reply-all/forward use SMTP. Rules are persisted and executable, with a separate existing-mail Preview/Apply step. Missing special folders are configured explicitly through Folder Settings. No permanent deletion is a fallback. See [MAIL_WORKFLOWS.md](MAIL_WORKFLOWS.md) for capabilities, persistence, limits and validation evidence. The older demo-only contract below is historical.

# Menu and mailbox layout contract

The desktop uses the OS application menu: macOS menu bar and Windows window menu. Browser delivery uses a keyboard-accessible top menu. Account setup belongs in the application/File menu; Rules belongs in Mailbox. Neither appears in the folder sidebar or a ribbon. No Calendar or To-Do placeholder is added until those features exist.

The left pane contains unified/smart mailboxes and account folder navigation only. The center lists messages in the selected mailbox. The right pane shows the selected message with labelled Reply, Reply All, Forward, Archive, Delete, Junk/Not Junk, read/unread and flag controls. Message commands are also available in the Message menu and follow the same selection/capability state.

Junk is shown for messages outside Junk/Spam and moves a demo message into Junk. Not Junk is shown for messages inside Junk/Spam and moves it to that account's Inbox. Delete moves to Deleted Items and is disabled there; it never silently becomes permanent deletion. Empty Junk/Deleted Items remains a scoped, confirmed mailbox action.

Connected accounts remain read-only in this increment. Reply/Reply All/Forward are disabled until sending is implemented; live mutation controls are disabled with an explanation. Demo actions affect fictional data only. Interface placement and demo movement do not constitute a provider mutation adapter.

Acceptance: native menus open Accounts and Rules; no sidebar command buttons or ribbon remain; Message-menu state matches the reading pane; selection changes update Junk/Not Junk and flag/read labels; returning a junk message preserves its account; no-selection/read-only actions stay disabled; source and packaged smoke tests cover these paths. Use the user's supplied Outlook/Mail references for familiar density and three-pane hierarchy, with Made Mail's own assets.

The [Apple Mail REA inspection](research/APPLE_MAIL_REA.md) supplies shipped-resource evidence for native menus, settings concepts, message-command labels and layout resources. It does not establish exact runtime menu order or supersede the user’s preference for Outlook-style rules.

export function emptyMailbox(messages, folder, accountId) {
  if (!['junk', 'trash'].includes(folder)) throw new Error('Only Junk and Deleted Items can be emptied');
  return messages.filter(message => message.folder !== folder || (accountId !== undefined && message.accountId !== accountId));
}

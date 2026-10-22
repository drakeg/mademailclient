export function emptyMailbox(messages, folder) {
  if (!['junk', 'trash'].includes(folder)) throw new Error('Only Junk and Deleted Items can be emptied');
  return messages.filter(message => message.folder !== folder);
}

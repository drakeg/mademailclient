const folders = new Set(['junk', 'trash']);
function validMailboxRequest(event, contents, folder) {
  return folders.has(folder) && event.sender === contents && event.senderFrame === contents.mainFrame && event.senderFrame?.url === 'mademail://app/';
}
function registerMailboxMenu(ipcMain, Menu, getWindow) {
  ipcMain.handle('mailbox:context-menu', (event, folder) => {
    const window = getWindow();
    if (!window || !validMailboxRequest(event, window.webContents, folder)) throw new Error('Invalid mailbox menu request');
    return new Promise(resolve => {
      const label = folder === 'junk' ? 'Empty Junk…' : 'Empty Deleted Items…';
      Menu.buildFromTemplate([{label, click:()=>resolve('empty')}]).popup({window,callback:()=>resolve(null)});
    });
  });
}
module.exports = { validMailboxRequest, registerMailboxMenu };

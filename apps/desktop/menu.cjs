// Electron roles delegate standard commands and keyboard shortcuts to the OS.
function createMenuTemplate(platform, { showAbout, mailboxCommand = () => {}, restoreWindow = () => {}, accountsCommand = () => {} }) {
  const mac = platform === 'darwin';
  const edit = [
    { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
    { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
    ...(mac ? [{ role: 'pasteAndMatchStyle' }, { role: 'delete' }] : [{ role: 'delete' }]),
    { role: 'selectAll' },
    ...(mac ? [{ type: 'separator' }, { label: 'Speech', submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }] }] : []),
  ];
  return [
    ...(mac ? [{ label: 'Made Mail', submenu: [
      { role: 'about' }, { type: 'separator' },
      { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => accountsCommand('manage') },
      { label: 'Accounts…', click: () => accountsCommand('manage') },
      { label: 'Add Account…', click: () => accountsCommand('add') },
      { type: 'separator' }, { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' }, { role: 'quit' },
    ] }] : []),
    { label: mac ? 'File' : '&File', submenu: [
      { label: 'Add Account…', click: () => accountsCommand('add') },
      ...(!mac ? [{ label: 'Account Settings…', click: () => accountsCommand('manage') }] : []),
      { type: 'separator' },
      { role: 'close' },
      ...(!mac ? [{ type: 'separator' }, { role: 'quit', label: 'E&xit' }] : []),
    ] },
    { label: mac ? 'Edit' : '&Edit', submenu: edit },
    { label: mac ? 'View' : '&View', submenu: [
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
      { label: 'Restore Standard Window', accelerator: 'CmdOrCtrl+Shift+0', click: restoreWindow },
    ] },
    { label: mac ? 'Mailbox' : '&Mailbox', submenu: [
      { label: 'Empty Junk…', click: () => mailboxCommand('junk') },
      { label: 'Empty Deleted Items…', click: () => mailboxCommand('trash') },
    ] },
    ...(mac ? [{ role: 'windowMenu' }] : []),
    { role: 'help', label: mac ? 'Help' : '&Help', submenu: [
      ...(!mac ? [{ label: '&About Made Mail', click: showAbout }] : [
        { label: 'About this preview', click: showAbout },
      ]),
    ] },
  ];
}
module.exports = { createMenuTemplate };

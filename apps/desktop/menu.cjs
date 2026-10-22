// Electron roles delegate standard commands and keyboard shortcuts to the OS.
function createMenuTemplate(platform, { showAbout }) {
  const mac = platform === 'darwin';
  const edit = [
    { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
    { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
    ...(mac ? [{ role: 'pasteAndMatchStyle' }, { role: 'delete' }] : [{ role: 'delete' }]),
    { role: 'selectAll' },
    ...(mac ? [{ type: 'separator' }, { label: 'Speech', submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }] }] : []),
  ];
  return [
    ...(mac ? [{ role: 'appMenu' }] : []),
    { label: mac ? 'File' : '&File', submenu: [
      { role: 'close' },
      ...(!mac ? [{ type: 'separator' }, { role: 'quit', label: 'E&xit' }] : []),
    ] },
    { label: mac ? 'Edit' : '&Edit', submenu: edit },
    { label: mac ? 'View' : '&View', submenu: [
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
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

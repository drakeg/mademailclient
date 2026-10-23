const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopMail', {
  isDesktop: true,
  accounts: Object.fromEntries(['list','add','remove','inbox','body'].map(name => [name, input => ipcRenderer.invoke('accounts:'+name,input)])),
  onAccountsCommand: callback => {
    if (typeof callback !== 'function') return;
    const listener = (_event, mode) => { if (['add','manage'].includes(mode)) callback(mode); };
    ipcRenderer.on('accounts:open', listener);
    return () => ipcRenderer.removeListener('accounts:open', listener);
  },
  chooseMailboxAction: folder => {
    if (!['junk', 'trash'].includes(folder)) return Promise.reject(new Error('Unsupported mailbox'));
    return ipcRenderer.invoke('mailbox:context-menu', folder);
  },
  onMailboxCommand: callback => {
    if (typeof callback !== 'function') return;
    const listener = (_event, folder) => { if (['junk','trash'].includes(folder)) callback(folder); };
    ipcRenderer.on('mailbox:empty', listener);
    return () => ipcRenderer.removeListener('mailbox:empty', listener);
  },
});

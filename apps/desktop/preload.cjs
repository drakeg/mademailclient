const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopMail', {
  isDesktop: true,
  onMenuCommand: callback => {
    if(typeof callback!=='function')return;
    const allowed=new Set(['folderSettings','actionHistory','move','compose','outgoing','rules','preview','columns','density','reply','replyAll','forward','archive','trash','junk','notJunk','unread','flag']);
    const listener=(_event,command)=>{if(allowed.has(command))callback(command);};
    ipcRenderer.on('menu:command',listener);
    return ()=>ipcRenderer.removeListener('menu:command',listener);
  },
  setMessageMenuState: state => ipcRenderer.send('message:menu-state',state),
  mail: Object.fromEntries(['apply','history','getSettings','saveSettings'].map(name=>[name,input=>ipcRenderer.invoke('mail:'+name,input)])),
  rules: Object.fromEntries(['list','save','remove','reorder','preview','run'].map(name=>[name,input=>ipcRenderer.invoke('rules:'+name,input)])),
  outgoing: Object.fromEntries(['list','save','discard','send'].map(name=>[name,input=>ipcRenderer.invoke('outgoing:'+name,input)])),
  attachments: {save:input=>ipcRenderer.invoke('attachments:save',input)},
  accounts: Object.fromEntries(['list','add','update','discover','remove','inbox','body','content','folders','folder','providers','signIn','cancelSignIn'].map(name => [name, input => ipcRenderer.invoke('accounts:'+name,input)])),
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

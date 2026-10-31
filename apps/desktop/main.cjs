const { app, BrowserWindow, Menu, protocol, session, dialog, ipcMain, safeStorage, shell } = require('electron');
const {createMailActions,registerMailActions}=require('./mail-actions.cjs');
const {createMailRules,registerMailRules}=require('./mail-rules.cjs');
const {createOutgoing,registerOutgoing}=require('./outgoing.cjs');
const {registerAttachments}=require('./attachments.cjs');
const { createOAuthService } = require('./oauth-service.cjs');
const { registerOAuthIPC } = require('./oauth-ipc.cjs');
const { verifySmtp } = require('./smtp.cjs');
const { createVault, registerAccounts, withInbox } = require('./accounts.cjs');
const { join } = require('node:path');
const { assetResponse } = require('./assets.cjs');
const { createMenuTemplate } = require('./menu.cjs');
const { attachSmokeTest } = require('./smoke.cjs');
const { registerMessageMenuState } = require('./message-menu.cjs');
const { registerMailboxMenu } = require('./mailbox-ipc.cjs');
const smokeTest = process.argv.includes('--smoke-test');
if (smokeTest && process.env.MADEMAIL_SMOKE_PROFILE) app.setPath('userData', process.env.MADEMAIL_SMOKE_PROFILE);
const primary=smokeTest||app.requestSingleInstanceLock();
if(!primary)app.quit();
let oauthService;
app.on('open-url',(event,url)=>{event.preventDefault();oauthService?.acceptCallback(url);});
app.on('second-instance',(_event,args)=>{for(const arg of args)if(typeof arg==='string'&&arg.startsWith('com.mademailclient.auth://'))oauthService?.acceptCallback(arg);});
app.on('before-quit',()=>oauthService?.cancel());
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{scheme:'mademail',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let window;
function sendCommand(channel,command) {
  if(!window||window.isDestroyed()) {
    createWindow();window.webContents.once('did-finish-load',()=>window?.webContents.send(channel,command));
  } else {window.show();window.focus();window.webContents.send(channel,command);}
}
function createWindow() {
  window = new BrowserWindow({icon:join(__dirname,'icons/icon.png'),show:!smokeTest,frame:true,titleBarStyle:'default',fullscreen:false,minimizable:true,maximizable:true,closable:true,width:1280,height:850,minWidth:720,minHeight:540,title:'Made Mail',backgroundColor:'#f6f7f5',webPreferences:{preload:join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  window.setMenuBarVisibility(true);
  if (process.platform === 'darwin') window.setWindowButtonVisibility(true);
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(url !== 'mademail://app/') event.preventDefault();});
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  window.on('closed',()=>{oauthService?.cancel();window=null;});
  if (smokeTest) attachSmokeTest(app, window, Menu);
  window.loadURL('mademail://app/');
}
if(primary)app.whenReady().then(()=>{
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(join(__dirname,'icons/icon.png'));
  protocol.handle('mademail',request=>assetResponse(join(__dirname,'../..'),request));
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  if (process.platform === 'darwin') app.setActivationPolicy('regular');
  app.setName('Made Mail');
  app.setAboutPanelOptions({ applicationName: 'Made Mail', applicationVersion: app.getVersion(), copyright: 'Made Mail contributors' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(createMenuTemplate(process.platform, {
    accountsCommand: mode => sendCommand('accounts:open',mode),
    rulesCommand: () => sendCommand('menu:command','rules'),
    messageCommand: command => sendCommand('menu:command',command),
    viewCommand: command => sendCommand('menu:command',command),
    restoreWindow: () => {
      if (!window) { createWindow(); return; }
      window.setFullScreen(false);
      if (window.isMinimized()) window.restore();
      window.setMenuBarVisibility(true);
      if (process.platform === 'darwin') window.setWindowButtonVisibility(true);
      window.show(); window.focus();
    },
    mailboxCommand: folder => { if (window && !window.isDestroyed()) window.webContents.send('mailbox:empty', folder); },
    showAbout: () => dialog.showMessageBox({ type: 'info', title: 'About Made Mail', message: 'Made Mail', detail: `Version ${app.getVersion()}\nIMAP mail, SMTP sending, saved rules and mailbox actions.` }),
  })));
  registerMessageMenuState(ipcMain,Menu,()=>window);
  registerMailboxMenu(ipcMain, Menu, () => window);
  const vault=createVault(join(app.getPath('userData'),'accounts.enc'),safeStorage);
  const bundled=require('./oauth-clients.json');
  const config={google:{clientId:process.env.MADEMAIL_GOOGLE_CLIENT_ID||bundled.google?.clientId||''},yahoo:{clientId:process.env.MADEMAIL_YAHOO_CLIENT_ID||bundled.yahoo?.clientId||''}};
  oauthService=createOAuthService({vault,config,nativeCallbackReady:app.isPackaged&&app.isDefaultProtocolClient('com.mademailclient.auth'),openExternal:url=>shell.openExternal(url),testInbox:a=>withInbox(a,async()=>{}),testSmtp:verifySmtp});
  registerOAuthIPC(ipcMain,()=>window,oauthService);
  const encrypted=name=>createVault(join(app.getPath('userData'),name+'.enc'),safeStorage);
  const mailActions=createMailActions({vault,journal:encrypted('mail-actions'),settings:encrypted('folder-settings'),resolveAccount:a=>oauthService.prepare(a)});
  const mailRules=createMailRules({vault,store:encrypted('rules'),cursors:encrypted('rule-cursors'),actions:mailActions,resolveAccount:a=>oauthService.prepare(a)});
  registerMailActions(ipcMain,()=>window,mailActions);registerMailRules(ipcMain,()=>window,mailRules);
  registerAttachments(ipcMain,()=>window,vault,dialog,{resolveAccount:a=>oauthService.prepare(a)});
  registerAccounts(ipcMain,()=>window,vault,{resolveAccount:account=>oauthService.prepare(account),onInbox:(account,page)=>mailRules.processIncoming(account,page)});
  const journal=createVault(join(app.getPath('userData'),'outgoing.enc'),safeStorage);
  registerOutgoing(ipcMain,()=>window,createOutgoing({vault,journal,resolveAccount:account=>oauthService.prepare(account)}));
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform !== 'darwin')app.quit();});

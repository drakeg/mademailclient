const { app, BrowserWindow, Menu, protocol, session, dialog, ipcMain } = require('electron');
const { join } = require('node:path');
const { assetResponse } = require('./assets.cjs');
const { createMenuTemplate } = require('./menu.cjs');
const { attachSmokeTest } = require('./smoke.cjs');
const { registerMailboxMenu } = require('./mailbox-ipc.cjs');
const smokeTest = process.argv.includes('--smoke-test');
if (smokeTest && process.env.MADEMAIL_SMOKE_PROFILE) app.setPath('userData', process.env.MADEMAIL_SMOKE_PROFILE);
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{scheme:'mademail',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let window;
function createWindow() {
  window = new BrowserWindow({show:!smokeTest,frame:true,titleBarStyle:'default',fullscreen:false,minimizable:true,maximizable:true,closable:true,width:1280,height:850,minWidth:720,minHeight:540,title:'Made Mail',backgroundColor:'#f6f7f5',webPreferences:{preload:join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  window.setMenuBarVisibility(true);
  if (process.platform === 'darwin') window.setWindowButtonVisibility(true);
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(url !== 'mademail://app/') event.preventDefault();});
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  window.on('closed',()=>{window=null;});
  if (smokeTest) attachSmokeTest(app, window, Menu);
  window.loadURL('mademail://app/');
}
app.whenReady().then(()=>{
  protocol.handle('mademail',request=>assetResponse(join(__dirname,'../..'),request));
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  if (process.platform === 'darwin') app.setActivationPolicy('regular');
  app.setName('Made Mail');
  app.setAboutPanelOptions({ applicationName: 'Made Mail', applicationVersion: app.getVersion(), copyright: 'Made Mail contributors' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(createMenuTemplate(process.platform, {
    accountsCommand: mode => { if (window && !window.isDestroyed()) window.webContents.send('accounts:open', mode); },
    restoreWindow: () => {
      if (!window) { createWindow(); return; }
      window.setFullScreen(false);
      if (window.isMinimized()) window.restore();
      window.setMenuBarVisibility(true);
      if (process.platform === 'darwin') window.setWindowButtonVisibility(true);
      window.show(); window.focus();
    },
    mailboxCommand: folder => { if (window && !window.isDestroyed()) window.webContents.send('mailbox:empty', folder); },
    showAbout: () => dialog.showMessageBox({ type: 'info', title: 'About Made Mail', message: 'Made Mail', detail: `Version ${app.getVersion()}\nDesktop preview with fictional mail. Real account connections are not available yet.` }),
  })));
  registerMailboxMenu(ipcMain, Menu, () => window);
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform !== 'darwin')app.quit();});

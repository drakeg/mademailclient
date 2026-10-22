const { app, BrowserWindow, Menu, protocol, session, dialog } = require('electron');
const { join } = require('node:path');
const { assetResponse } = require('./assets.cjs');
const { createMenuTemplate } = require('./menu.cjs');
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{scheme:'mademail',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let window;
function createWindow() {
  window = new BrowserWindow({width:1280,height:850,minWidth:720,minHeight:540,title:'Made Mail',backgroundColor:'#f6f7f5',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(url !== 'mademail://app/') event.preventDefault();});
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  window.on('closed',()=>{window=null;});
  window.loadURL('mademail://app/');
}
app.whenReady().then(()=>{
  protocol.handle('mademail',request=>assetResponse(join(__dirname,'../..'),request));
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  app.setName('Made Mail');
  app.setAboutPanelOptions({ applicationName: 'Made Mail', applicationVersion: app.getVersion(), copyright: 'Made Mail contributors' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(createMenuTemplate(process.platform, {
    showAbout: () => dialog.showMessageBox({ type: 'info', title: 'About Made Mail', message: 'Made Mail', detail: `Version ${app.getVersion()}\nDesktop preview with fictional mail. Real account connections are not available yet.` }),
  })));
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform !== 'darwin')app.quit();});

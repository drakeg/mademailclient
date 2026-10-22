const { app, BrowserWindow, Menu, protocol, session } = require('electron');
const { join } = require('node:path');
const { assetResponse } = require('./assets.cjs');
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
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{label:'Made Mail',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{type:'separator'},{role:'quit'}]}] : []),
    {label:'File',submenu:[{role:process.platform === 'darwin'?'close':'quit'}]},
    {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},
    {label:'Window',submenu:[{role:'minimize'},{role:'zoom'}]}
  ]));
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform !== 'darwin')app.quit();});

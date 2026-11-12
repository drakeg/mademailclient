function registerOAuthIPC(ipcMain,getWindow,service){
 const handlers={providers:()=>service.status(),signIn:input=>service.signIn(input),cancelSignIn:()=>{service.cancel();return null;}};
 for(const [name,handler]of Object.entries(handlers))ipcMain.handle('accounts:'+name,async(event,input)=>{
  const contents=getWindow()?.webContents;
  if(!contents||event.sender!==contents||event.senderFrame!==contents.mainFrame||event.senderFrame.url!=='mademail://app/')return {ok:false,error:'Unauthorized account request'};
  try{return {ok:true,data:await handler(input)};}catch(error){return {ok:false,code:error.publicCode||'SIGN_IN_FAILED',error:error.publicMessage||'Sign-in did not complete. No account changes were saved. Check provider approval, your connection, or try again.'};}
 });
}
module.exports={registerOAuthIPC};

const fs=require('node:fs/promises');
const {withMailbox,createOperationQueue}=require('./accounts.cjs');
const {readMessageContent,messageReference,MAX_ATTACHMENT,fail}=require('./incoming.cjs');
function registerAttachments(ipcMain,getWindow,vault,dialog,{resolveAccount=async a=>a,readContent=(a,input)=>readMessageContent(a,input,{withMailbox}),writeFile=fs.writeFile}={}){
 const enqueue=createOperationQueue(1,8);
 ipcMain.handle('attachments:save',async(event,input)=>{
  const authorized=()=>{const win=getWindow();return win&&!win.isDestroyed()&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&event.senderFrame.url==='mademail://app/';};
  if(!authorized())return {ok:false,error:'Unauthorized request'};
  try{return {ok:true,data:await enqueue(async()=>{
   if(!authorized())throw fail('REQUEST_CANCELLED','The requesting window closed.');
   const ref=messageReference(input);
   if(!Number.isInteger(input.index)||input.index<0||input.index>=100||typeof input.digest!=='string'||!/^[a-f0-9]{64}$/.test(input.digest))throw fail('INVALID_ATTACHMENT','Reload this message before saving its attachment.');
   const account=(await vault.list()).find(a=>a.id===ref.accountId);
   if(!account)throw fail('ACCOUNT_NOT_FOUND','This account was removed.');
   const content=await readContent(await resolveAccount(account),ref),attachment=content.attachments[input.index];
   if(!attachment||attachment.digest!==input.digest)throw fail('ATTACHMENT_CHANGED','This attachment changed. Reload the message before saving it.');
   if(attachment.size>MAX_ATTACHMENT)throw fail('ATTACHMENT_TOO_LARGE','This attachment exceeds the 20 MB save limit.');
   if(!authorized())throw fail('REQUEST_CANCELLED','The requesting window closed.');
   const result=await dialog.showSaveDialog(getWindow(),{title:'Save Attachment',defaultPath:attachment.filename,buttonLabel:'Save',properties:['createDirectory','showOverwriteConfirmation']});
   if(result.canceled||!result.filePath)return {canceled:true};
   if(!authorized())throw fail('REQUEST_CANCELLED','The requesting window closed.');
   if(!(await vault.list()).some(a=>a.id===ref.accountId))throw fail('ACCOUNT_NOT_FOUND','This account was removed.');
   if(!authorized())throw fail('REQUEST_CANCELLED','The requesting window closed.');
   // The destination comes exclusively from the native dialog. Exclusive create
   // refuses existing files and symlinks rather than silently replacing either.
   await writeFile(result.filePath,attachment.content,{flag:'wx',mode:0o600});
   return {canceled:false,filename:attachment.filename};
  })};}catch(error){return {ok:false,code:error.code==='EEXIST'?'ATTACHMENT_EXISTS':error.publicCode||'ATTACHMENT_SAVE_FAILED',error:error.code==='EEXIST'?'A file with that name already exists. Choose a different name.':error.publicMessage||'The attachment could not be saved. Check the connection and destination folder.'};}
 });
}
module.exports={registerAttachments};

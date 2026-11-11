const {randomUUID}=require('node:crypto');
const MailComposer=require('nodemailer/lib/mail-composer');
const {emailAddress}=require('./mail-network.cjs');
const {createSmtpTransport}=require('./smtp.cjs');
const {withConnection}=require('./accounts.cjs');
const {assertProviderHosts}=require('./oauth-providers.cjs');
const {readMessageContent,messageReference,fail}=require('./incoming.cjs');
const {withMailbox,createOperationQueue}=require('./accounts.cjs');
const {MAX_STORED_BYTES,checkFiles,encodeAttachment,readSelectedFiles,publicRecord,mimeAttachments}=require('./outgoing-files.cjs');
function address(value){
 const result=emailAddress(value);
 if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+$/i.test(result))throw new Error('Use plain email addresses, separated by commas.');
 return result;
}
function forwardRequest(input){
 const source=messageReference(input?.source);
 if(!Array.isArray(input.attachments)||!input.attachments.length||input.attachments.length>100)throw fail('INVALID_ATTACHMENT','Reload the original message before forwarding.');
 const attachments=input.attachments.map(a=>{if(!Number.isInteger(a.index)||a.index<0||a.index>=100||typeof a.digest!=='string'||!/^[a-f0-9]{64}$/.test(a.digest))throw fail('INVALID_ATTACHMENT','Reload the original message before forwarding.');return {index:a.index,digest:a.digest};});
 return {source,attachments};
}
function validateDraft(input){
 if(!input||typeof input!=='object'||typeof input.accountId!=='string')throw new Error('Select a sending account.');
 const recipients=value=>{
  if(typeof value!=='string'||value.length>26000)throw new Error('Check recipients.');
  return value.split(',').map(v=>v.trim()).filter(Boolean).map(address);
 };
 const to=recipients(input.to||''),cc=recipients(input.cc||''),bcc=recipients(input.bcc||'');
 if(to.length+cc.length+bcc.length>100)throw new Error('Limit messages to 100 recipients.');
 if(typeof input.subject!=='string'||input.subject.length>998||/[\r\n\0]/.test(input.subject))throw new Error('Check the subject.');
 if(typeof input.text!=='string'||Buffer.byteLength(input.text)>512000||input.text.includes('\0'))throw new Error('Message text must be under 500 KB.');
 const inReplyTo=typeof input.inReplyTo==='string'&&/^<[^\s<>\x00-\x1f\x7f]{1,990}>$/.test(input.inReplyTo)?input.inReplyTo:undefined;
 return {accountId:input.accountId,to,cc,bcc,subject:input.subject,text:input.text,...(inReplyTo?{inReplyTo}:{})};
}
async function submitMessage(account,record,{smtp=createSmtpTransport}={}){
 if(account.oauth){assertProviderHosts(account);if(account.oauth.provider!=='google')throw new Error('This authorization is read-only.');}
 if(!account.smtp)throw new Error('Configure outgoing SMTP settings.');
 const from=address(account.email),messageId=`<${record.id}@mademail.local>`;
 const raw=await new MailComposer({from,to:record.to,cc:record.cc,bcc:record.bcc,subject:record.subject,text:record.text,messageId,inReplyTo:record.inReplyTo,references:record.inReplyTo,attachments:mimeAttachments(record),disableFileAccess:true,disableUrlAccess:true}).compile().build();
 const transport=await smtp({...account.smtp,...(account.oauth?{accessToken:account.oauth.accessToken}:{})});
 let result;
 try{result=await transport.sendMail({envelope:{from,to:[...new Set([...record.to,...record.cc,...record.bcc])]},raw});}finally{transport.close();}
 if(!result.accepted?.length)throw new Error('No recipient was accepted.');
 return {raw,messageId,partial:!!result.rejected?.length};
}
async function saveSentCopy(account,raw,{connect=withConnection}={}){
 // Gmail saves submitted SMTP messages itself. Avoid a second Sent copy.
 if(account.smtp?.host==='smtp.gmail.com')return 'provider-managed';
 return connect(account,async c=>{
  const sent=(await c.list()).find(f=>f.specialUse==='\\Sent'&&!f.flags?.has('\\Noselect'));
  if(!sent)return 'unavailable';
  const result=await c.append(sent.path,raw,['\\Seen']);return result?'saved':'unavailable';
 });
}
function createOutgoing({vault,journal,resolveAccount=async a=>a,submit=submitMessage,saveCopy=saveSentCopy,readFiles=readSelectedFiles,readContent=(a,ref)=>readMessageContent(a,ref,{withMailbox})}){
 let busy=false;
 const update=(id,change)=>journal.update(all=>all.map(r=>r.id===id?{...r,...change}:r));
 async function account(id){const a=(await vault.list()).find(a=>a.id===id);if(!a)throw new Error('Sending account no longer exists.');return a;}
 async function editable(id){const record=(await journal.list()).find(r=>r.id===id);if(!record||record.status!=='draft')throw fail('DRAFT_LOCKED','This draft is unavailable or already submitted.');await account(record.accountId);return record;}
 async function storeFiles(record,files,guard=()=>true,clearPending=false){
  if(!guard())throw fail('REQUEST_CANCELLED','The requesting window closed.');
  await account(record.accountId);
  await journal.update(all=>{
   if(!guard())throw fail('REQUEST_CANCELLED','The requesting window closed.');
   const current=all.find(r=>r.id===record.id);if(!current||current.status!=='draft'||current.revision!==record.revision)throw fail('DRAFT_CHANGED','Draft changed while adding attachments. Review it and try again.');
   const attachments=[...(current.attachments||[]),...files];checkFiles(attachments);
   const otherBytes=all.filter(r=>r.id!==record.id).reduce((sum,r)=>sum+(r.attachments||[]).reduce((n,a)=>n+a.size,0),0);
   if(otherBytes+attachments.reduce((sum,a)=>sum+a.size,0)>MAX_STORED_BYTES)throw fail('ATTACHMENT_STORAGE_FULL','Local attachment storage is full (40 MB). Remove old local records or attachments.');
   return all.map(r=>r.id===record.id?{...r,attachments,pendingForward:clearPending?false:!!current.pendingForward,forwardSource:clearPending?undefined:current.forwardSource,revision:randomUUID(),updatedAt:new Date().toISOString()}:r);
  });return publicRecord((await journal.list()).find(r=>r.id===record.id));
 }
 return {
  async attachFiles(id,paths,guard=()=>true){const record=await editable(id);return storeFiles(record,await readFiles(paths,guard),guard);},
  async removeAttachment({id,attachmentId}){await editable(id);await journal.update(all=>all.map(r=>r.id===id&&r.status==='draft'?{...r,attachments:(r.attachments||[]).filter(a=>a.id!==attachmentId),revision:randomUUID()}:r));return publicRecord(await editable(id));},
  async forwardAttachments(input,guard=()=>true){
   if(!guard())throw fail('REQUEST_CANCELLED','The requesting window closed.');
   let record=await editable(input.id);const requested=forwardRequest(input),ref=requested.source;
   if(record.accountId!==ref.accountId)throw fail('FORWARD_ACCOUNT','Start forwarding from the original account.');
   await journal.update(all=>{if(!all.some(r=>r.id===record.id&&r.status==='draft'&&r.revision===record.revision))throw fail('DRAFT_CHANGED','Draft changed. Review before forwarding.');return all.map(r=>r.id===record.id?{...r,pendingForward:true,forwardSource:requested,revision:randomUUID()}:r);});record=await editable(input.id);
   if(!Array.isArray(input.attachments)||!input.attachments.length||input.attachments.length>10)throw fail('ATTACHMENT_LIMIT','Forward at most 10 attachments, or explicitly choose text only.');
   const source=await readContent(await resolveAccount(await account(ref.accountId)),ref),files=[],seen=new Set();
   for(const expected of input.attachments){
    if(!Number.isInteger(expected.index)||seen.has(expected.index))throw fail('ATTACHMENT_CHANGED','Reload the original message before forwarding.');seen.add(expected.index);
    const a=source.attachments[expected.index];if(!a||a.digest!==expected.digest)throw fail('ATTACHMENT_CHANGED','The original attachment changed. Reload the message.');
    files.push(encodeAttachment(a.filename,a.content,a.contentType));
   }
   return storeFiles(record,files,guard,true);
  },
  async clearForwardPending(id){await editable(id);await journal.update(all=>all.map(r=>r.id===id&&r.status==='draft'?{...r,pendingForward:false,forwardSource:undefined,revision:randomUUID()}:r));return publicRecord(await editable(id));},
  async list(){return (await journal.list()).map(r=>publicRecord({...r,status:r.status==='sending'?'unknown':r.status}));},
  async save(input){
   const draft=validateDraft(input),forwardSource=input.forwardSource?forwardRequest(input.forwardSource):undefined;const a=await account(draft.accountId);
   if(!a.smtp||a.oauth&&a.oauth.provider!=='google')throw new Error('This account does not support sending.');
   const id=input.id||randomUUID();
   await journal.update(all=>{
    const previous=all.find(r=>r.id===id);
    if(input.id&&!previous)throw new Error('Draft no longer exists.');
    if(previous&&previous.status!=='draft')throw new Error('This submission is locked. Check its status before composing another message.');
    if(!previous&&all.length>=200)throw new Error('Remove old local drafts/submission records first (200-record limit).');
    const next={...draft,attachments:previous?.attachments||[],pendingForward:!!forwardSource||previous?.pendingForward||false,forwardSource:forwardSource||previous?.forwardSource,id,revision:randomUUID(),status:'draft',updatedAt:new Date().toISOString()};return [...all.filter(r=>r.id!==id),next];
   });return {id};
  },
  async discard(id){await journal.update(all=>{if(busy&&all.some(r=>r.id===id&&r.status==='sending'))throw new Error('A submission is in progress.');return all.filter(r=>r.id!==id);});},
  async send(id){
   if(busy)throw new Error('Another submission is in progress.');busy=true;
   try{
    const record=(await journal.list()).find(r=>r.id===id);
    if(!record||record.status!=='draft')throw new Error('Already submitted or outcome unknown. No message was resent.');
    if(record.pendingForward)throw fail('FORWARD_INCOMPLETE','Original attachments were not imported. Retry or explicitly choose text-only forwarding.');
    if(!record.to.length)throw new Error('Add at least one To recipient.');
    const a=await resolveAccount(await account(record.accountId));
    // Persist before handing control to SMTP. A crash/time-out is never auto-retried.
    await journal.update(all=>{
     if(!all.some(r=>r.id===id&&r.status==='draft'&&r.revision===record.revision))throw new Error('Draft changed. Review before sending.');
     return all.map(r=>r.id===id?{...r,status:'sending'}:r);
    });
    let result;
    try{result=await submit(a,record);}catch{await update(id,{status:'unknown'});return {status:'unknown'};}
    // Persist SMTP acceptance before any attempt to create the Sent copy.
    await update(id,{status:'accepted',partial:result.partial,messageId:result.messageId,copy:'pending'});
    let copy='unavailable';try{copy=await saveCopy(a,result.raw);}catch{}
    await update(id,{copy});return {status:'accepted',partial:result.partial,copy};
   }finally{busy=false;}
  }
 };
}
function registerOutgoing(ipcMain,getWindow,service,{dialog}={}){
 const pickQueue=createOperationQueue(1,8);
 const authorized=event=>{const contents=getWindow()?.webContents;return !!contents&&event.sender===contents&&event.senderFrame===contents.mainFrame&&event.senderFrame.url==='mademail://app/';};
 ipcMain.handle('outgoing:chooseAttachments',async(event,id)=>{
  if(!authorized(event))return {ok:false,error:'Unauthorized request'};
  try{return {ok:true,data:await pickQueue(async()=>{
   if(!authorized(event)||typeof id!=='string')throw fail('REQUEST_CANCELLED','Reopen the draft.');
   const result=await dialog.showOpenDialog(getWindow(),{title:'Attach Files',properties:['openFile','multiSelections']});
   if(result.canceled)return {canceled:true};
   if(!authorized(event))throw fail('REQUEST_CANCELLED','The requesting window closed.');
   return service.attachFiles(id,result.filePaths,()=>authorized(event));
  })};}catch(e){return {ok:false,error:e.publicMessage||'Could not attach the selected files. The draft was preserved.'};}
 });
 for(const name of ['list','save','discard','send','removeAttachment','forwardAttachments','clearForwardPending'])ipcMain.handle('outgoing:'+name,async(event,input)=>{
  const contents=getWindow()?.webContents;
  if(!contents||event.sender!==contents||event.senderFrame!==contents.mainFrame||event.senderFrame.url!=='mademail://app/')return {ok:false,error:'Unauthorized request'};
  try{return {ok:true,data:await service[name](input,()=>authorized(event))};}catch(error){return {ok:false,error:error.publicMessage||'Outgoing operation failed. Check the selected account, recipients, local records and network. No automatic retry was attempted.'};}
 });
}
module.exports={validateDraft,submitMessage,saveSentCopy,createOutgoing,registerOutgoing};

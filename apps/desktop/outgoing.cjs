const {randomUUID}=require('node:crypto');
const MailComposer=require('nodemailer/lib/mail-composer');
const {emailAddress}=require('./mail-network.cjs');
const {createSmtpTransport}=require('./smtp.cjs');
const {withConnection}=require('./accounts.cjs');
const {assertProviderHosts}=require('./oauth-providers.cjs');
function address(value){
 const result=emailAddress(value);
 if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+$/i.test(result))throw new Error('Use plain email addresses, separated by commas.');
 return result;
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
 const raw=await new MailComposer({from,to:record.to,cc:record.cc,bcc:record.bcc,subject:record.subject,text:record.text,messageId,inReplyTo:record.inReplyTo,references:record.inReplyTo,disableFileAccess:true,disableUrlAccess:true}).compile().build();
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
function createOutgoing({vault,journal,resolveAccount=async a=>a,submit=submitMessage,saveCopy=saveSentCopy}){
 let busy=false;
 const update=(id,change)=>journal.update(all=>all.map(r=>r.id===id?{...r,...change}:r));
 async function account(id){const a=(await vault.list()).find(a=>a.id===id);if(!a)throw new Error('Sending account no longer exists.');return a;}
 return {
  async list(){return (await journal.list()).map(r=>({...r,status:r.status==='sending'?'unknown':r.status}));},
  async save(input){
   const draft=validateDraft(input);const a=await account(draft.accountId);
   if(!a.smtp||a.oauth&&a.oauth.provider!=='google')throw new Error('This account does not support sending.');
   const id=input.id||randomUUID();
   await journal.update(all=>{
    const previous=all.find(r=>r.id===id);
    if(input.id&&!previous)throw new Error('Draft no longer exists.');
    if(previous&&previous.status!=='draft')throw new Error('This submission is locked. Check its status before composing another message.');
    if(!previous&&all.length>=200)throw new Error('Remove old local drafts/submission records first (200-record limit).');
    const next={...draft,id,revision:randomUUID(),status:'draft',updatedAt:new Date().toISOString()};return [...all.filter(r=>r.id!==id),next];
   });return {id};
  },
  async discard(id){await journal.update(all=>{if(busy&&all.some(r=>r.id===id&&r.status==='sending'))throw new Error('A submission is in progress.');return all.filter(r=>r.id!==id);});},
  async send(id){
   if(busy)throw new Error('Another submission is in progress.');busy=true;
   try{
    const record=(await journal.list()).find(r=>r.id===id);
    if(!record||record.status!=='draft')throw new Error('Already submitted or outcome unknown. No message was resent.');
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
function registerOutgoing(ipcMain,getWindow,service){
 for(const name of ['list','save','discard','send'])ipcMain.handle('outgoing:'+name,async(event,input)=>{
  const contents=getWindow()?.webContents;
  if(!contents||event.sender!==contents||event.senderFrame!==contents.mainFrame||event.senderFrame.url!=='mademail://app/')return {ok:false,error:'Unauthorized request'};
  try{return {ok:true,data:await service[name](input)};}catch{return {ok:false,error:'Outgoing operation failed. Check the selected account, recipients, local records and network. No automatic retry was attempted.'};}
 });
}
module.exports={validateDraft,submitMessage,saveSentCopy,createOutgoing,registerOutgoing};

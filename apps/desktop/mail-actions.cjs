const {createHash}=require('node:crypto');
const {withConnection}=require('./accounts.cjs');
const {field}=require('./mail-network.cjs');
const actions=new Set(['move','trash','junk','notJunk','archive','markRead','markUnread','flag','unflag']);
const fail=message=>Object.assign(new Error(message),{publicMessage:message});
function writable(account){if(account.oauth&&account.oauth.provider!=='google')throw fail('This browser authorization is read-only. Reconnect with a supported write grant or app-password account.');}
function reference(value){
 if(!value||!Number.isSafeInteger(value.uid)||value.uid<1||typeof value.validity!=='string'||!/^\d+$/.test(value.validity)||!actions.has(value.action))throw fail('Select a current message and supported action.');
 return {accountId:field(value.accountId,'account'),path:field(value.path,'folder',1024),uid:value.uid,validity:value.validity,action:value.action,...(value.destination?{destination:field(value.destination,'destination',1024)}:{})};
}
function createMailActions({vault,journal,settings,resolveAccount=async a=>a,connect=withConnection}){
 let queue=Promise.resolve(),queued=0;
 async function run(input,operationKey){
  const ref=reference(input),key=operationKey||field(input.requestId,'request id',100);
  if(!/^[a-zA-Z0-9-]{8,100}$/.test(key))throw fail('Invalid operation id.');
  const signature=createHash('sha256').update(JSON.stringify(ref)).digest('hex');
  const old=(await journal.list()).find(r=>r.id===key);
  if(old){if(old.signature!==signature)throw fail('Operation id was already used.');return {...old,replayed:true,status:old.status==='pending'?'unknown':old.status};}
  let a=(await vault.list()).find(a=>a.id===ref.accountId);if(!a)throw fail('Account no longer exists.');writable(a);a=await resolveAccount(a);
  const folders=(await settings.list()).find(s=>s.id===a.id)?.folders||{};
  let attempted=false,destination;
  // A durable claim is written before connecting. Neither crashes nor uncertain MOVE responses are retried.
  await journal.update(all=>{if(all.length>=100000)throw fail('Action history is full. Export/review it before continuing.');if(all.some(r=>r.id===key))throw fail('Action already claimed.');return [...all,{id:key,signature,...ref,status:'pending',at:new Date().toISOString()}];});
  let result;
  try{
   await connect(a,async c=>{
    const listed=(await c.list()).filter(f=>!f.flags?.has('\\Noselect'));
    const special={trash:'\\Trash',junk:'\\Junk',archive:'\\Archive'};
    if(special[ref.action])destination=folders[ref.action]||listed.find(f=>f.specialUse===special[ref.action])?.path;
    if(ref.action==='notJunk')destination=listed.find(f=>f.path.toUpperCase()==='INBOX')?.path;
    if(ref.action==='move')destination=ref.destination;
    if(['move','trash','junk','archive','notJunk'].includes(ref.action)){
     if(!destination||!listed.some(f=>f.path===destination))throw fail('Choose this account’s destination in Mailbox → Folder Settings. No message was deleted.');
     if(destination===ref.path)throw fail('The message is already in that folder.');
     if(!c.capabilities.has('MOVE'))throw fail('This server does not advertise safe IMAP MOVE support. No copy/delete fallback was used.');
    }
    const lock=await c.getMailboxLock(ref.path,{readOnly:false});
    try{
     if(c.mailbox.readOnly)throw fail('This mailbox is read-only.');
     if(String(c.mailbox.uidValidity)!==ref.validity)throw fail('Mailbox identity changed. Refresh before changing messages.');
     if(!await c.fetchOne(ref.uid,{uid:true},{uid:true}))throw fail('Message no longer exists. Refresh this folder.');
     attempted=true;
     let success;
     if(destination)success=await c.messageMove(ref.uid,destination,{uid:true});
     else if(['markRead','flag'].includes(ref.action))success=await c.messageFlagsAdd(ref.uid,[ref.action==='flag'?'\\Flagged':'\\Seen'],{uid:true});
     else success=await c.messageFlagsRemove(ref.uid,[ref.action==='unflag'?'\\Flagged':'\\Seen'],{uid:true});
     if(!success)throw new Error('Server did not confirm action');
    }finally{lock.release();}
   });
   result={status:'done',...(destination?{destination}:{})};
  }catch(error){result={status:attempted?'unknown':'failed',error:attempted?'Server outcome unknown. Refresh and check the provider before trying a new action.':error.publicMessage||'Could not connect or authorize the mailbox. No action was submitted.'};}
  await journal.update(all=>all.map(r=>r.id===key?{...r,...result}:r));return {id:key,...result};
 }
 return {
  async apply(input,key){if(queued>=100)throw fail('Too many queued actions. Wait for the current changes to finish.');queued++;const task=queue.then(()=>run(input,key));queue=task.catch(()=>{});try{return await task;}finally{queued--; }},
  async history(){return (await journal.list()).slice(-200).reverse().map(r=>({...r,status:r.status==='pending'?'unknown':r.status}));},
  async getSettings(){return settings.list();},
  async saveSettings(input){
   if(!input||typeof input.accountId!=='string')throw fail('Choose an account.');
   const a=(await vault.list()).find(a=>a.id===input.accountId);if(!a)throw fail('Account no longer exists.');
   const paths=await connect(await resolveAccount(a),c=>c.list()),folders={};
   for(const key of ['trash','junk','archive']){const path=input.folders?.[key];if(path){if(!paths.some(f=>f.path===path&&!f.flags?.has('\\Noselect')))throw fail('Choose a selectable folder from this account.');folders[key]=path;}}
   await settings.update(all=>[...all.filter(s=>s.id!==a.id),{id:a.id,folders}]);return {id:a.id,folders};
  }
 };
}
function registerMailActions(ipcMain,getWindow,service){
 for(const name of ['apply','history','getSettings','saveSettings'])ipcMain.handle('mail:'+name,async(event,input)=>{
  const contents=getWindow()?.webContents;
  if(!contents||event.sender!==contents||event.senderFrame!==contents.mainFrame||event.senderFrame.url!=='mademail://app/')return {ok:false,error:'Unauthorized request'};
  try{return {ok:true,data:await service[name](input)};}catch(e){return {ok:false,error:e.publicMessage||'Mailbox action could not be completed. Existing mail was not automatically retried.'};}
 });
}
module.exports={createMailActions,registerMailActions,reference,writable};

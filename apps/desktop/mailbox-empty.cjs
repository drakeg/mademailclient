// Made Mail implementation. Only an explicitly confirmed Junk/Trash snapshot may be purged.
const {randomUUID,createHash}=require('node:crypto');
const {withConnection}=require('./accounts.cjs');
const {writable}=require('./mail-actions.cjs');
const fail=message=>Object.assign(new Error(message),{publicMessage:message});
const identity=a=>createHash('sha256').update(JSON.stringify([a.id,a.email,a.host,a.port,a.username,a.oauth?.provider])).digest('hex');
const label=role=>role==='junk'?'Junk':'Deleted Items';
// Deliberately avoid messageDelete: its UIDPLUS fallback can issue a mailbox-wide EXPUNGE.
async function targetedExpunge(client,uids){
 if(!uids.length||uids.length>500||uids.some(n=>!Number.isSafeInteger(n)||n<1||n>4294967295))throw fail('Invalid deletion snapshot.');
 const result=await client.exec('UID EXPUNGE',[{type:'SEQUENCE',value:uids.join(',')}]);
 try{if(result.response.command!=='OK')throw fail('Server did not confirm deletion.');}finally{result.next();}
}
function createMailboxEmpty({vault,journal,settings,resolveAccount=async a=>a,connect=withConnection,now=Date.now}){
 const previews=new Map();let queue=Promise.resolve();
 async function account(id){const a=(await vault.list()).find(a=>a.id===id);if(!a)throw fail('This account was removed.');writable(a);return a;}
 async function pathFor(a,role,c){
  const folders=(await settings.list()).find(s=>s.id===a.id)?.folders||{};
  const list=(await c.list()).filter(f=>!f.flags?.has('\\Noselect'));
  const path=folders[role]||list.find(f=>f.specialUse===(role==='junk'?'\\Junk':'\\Trash'))?.path;
  if(!path||path.toUpperCase()==='INBOX'||!list.some(f=>f.path===path))throw fail('Choose a valid Junk or Deleted Items folder in Mailbox → Folder Settings. Inbox can never be emptied.');
  if(!c.capabilities.has('UIDPLUS'))throw fail('This server cannot safely empty a message snapshot (UIDPLUS required). No mail was deleted.');
  return path;
 }
 return {
  async preview(input){
   if(!input||!['junk','trash'].includes(input.role))throw fail('Only Junk and Deleted Items can be emptied.');
   for(const [token,p] of previews)if(now()-p.at>300000)previews.delete(token);
   if(previews.size>=10)throw fail('Finish or cancel the existing confirmations first.');
   const a=await account(input.accountId),p={accountId:a.id,account:a.email,identity:identity(a),role:input.role,at:now()};
   await connect(await resolveAccount(a),async c=>{p.path=await pathFor(a,p.role,c);const lock=await c.getMailboxLock(p.path,{readOnly:true});try{
    if(c.mailbox.exists>5000)throw fail('Emptying is limited to 5,000 messages per confirmation. Reduce this folder using your provider first.');
    p.validity=String(c.mailbox.uidValidity);p.uids=await c.search({all:true},{uid:true});
    if(!Array.isArray(p.uids)||p.uids.length>5000||p.uids.some(n=>!Number.isSafeInteger(n)||n<1||n>4294967295))throw fail('Emptying is limited to 5,000 messages per confirmation. Reduce this folder using your provider first.');
   }finally{lock.release();}});
   const token=randomUUID();previews.set(token,p);return {token,account:p.account,path:p.path,role:p.role,count:p.uids.length};
  },
  cancel(token){previews.delete(token);},
  execute(token){const p=previews.get(token);previews.delete(token);if(!p)return Promise.reject(fail('This confirmation has already been used or canceled.'));
   const run=async()=>{
    if(now()-p.at>300000)throw fail('Confirmation expired. Choose Empty again.');
    const a=await account(p.accountId);if(identity(a)!==p.identity)throw fail('Account settings changed. Choose Empty again.');
    let attempted=false,claimed=false;
    try{await connect(await resolveAccount(a),async c=>{
     if(await pathFor(a,p.role,c)!==p.path)throw fail('Folder settings changed. Choose Empty again.');
     const lock=await c.getMailboxLock(p.path,{readOnly:false});try{
      if(now()-p.at>300000)throw fail('Confirmation expired. Choose Empty again.');
      if(c.mailbox.readOnly||String(c.mailbox.uidValidity)!==p.validity)throw fail('Folder is read-only or its identity changed. Choose Empty again.');
      await journal.update(all=>{if(all.length>=100000)throw fail('Empty history is full.');return [...all,{id:token,accountId:p.accountId,role:p.role,action:'empty '+p.role,path:p.path,count:p.uids.length,at:new Date(now()).toISOString(),status:'pending'}];});claimed=true;
      for(let offset=0;offset<p.uids.length;offset+=500){const ids=p.uids.slice(offset,offset+500);attempted=true;if(!await c.messageFlagsAdd(ids,['\\Deleted'],{uid:true}))throw Error('Flagging not confirmed');await targetedExpunge(c,ids);}
     }finally{lock.release();}
    });}catch(e){if(!claimed)throw e;const status=attempted?'unknown':'failed';await journal.update(all=>all.map(r=>r.id===token?{...r,status}:r));return {status,error:'Deletion may be incomplete. Refresh and check the provider before starting a new operation. No automatic retry was made.'};}
    await journal.update(all=>all.map(r=>r.id===token?{...r,status:'done'}:r));return {status:'done',count:p.uids.length};
   };const task=queue.then(run);queue=task.catch(()=>{});return task;
  },
  async history(){return (await journal.list()).slice(-200).reverse().map(r=>({...r,status:r.status==='pending'?'unknown':r.status}));}
 };
}
function registerMailboxEmpty(ipcMain,getWindow,service,dialog,{vault}={}){
 let busy=false;
 ipcMain.handle('mail:empty',async(event,input)=>{
  const win=getWindow(),contents=win?.webContents;
  if(!contents||event.sender!==contents||event.senderFrame!==contents.mainFrame||event.senderFrame.url!=='mademail://app/')return {ok:false,error:'Unauthorized request'};
  if(busy)return {ok:false,error:'Finish the existing Empty confirmation first.'};busy=true;let preview;
  try{
   if(!input||!['junk','trash'].includes(input.role))throw fail('Choose Junk or Deleted Items.');
   if(!input.accountId&&vault){const all=await vault.list();if(!all.length)throw fail('Add an account first.');if(all.length===1)input={...input,accountId:all[0].id};else{
    const choice=await dialog.showMessageBox(win,{type:'question',message:`Choose the account whose ${label(input.role)} you want to empty`,buttons:['Cancel',...all.map(a=>a.email)],defaultId:0,cancelId:0});
    if(!choice.response||!all[choice.response-1])return {ok:true,data:{status:'cancelled'}};input={...input,accountId:all[choice.response-1].id};
   }}
   preview=await service.preview(input);
   if(!preview.count){service.cancel(preview.token);return {ok:true,data:{status:'done',count:0}};}
   const answer=await dialog.showMessageBox(win,{type:'warning',message:`Permanently empty ${label(preview.role)}?`,detail:`Account: ${preview.account}\nFolder: ${preview.path}\nMessages: ${preview.count}\n\nThis cannot be undone. Search and unread filters do not limit this action. Messages arriving after this confirmation was prepared are excluded.`,buttons:['Cancel','Permanently Delete'],defaultId:0,cancelId:0,noLink:true});
   if(answer.response!==1){service.cancel(preview.token);return {ok:true,data:{status:'cancelled'}};}
   return {ok:true,data:await service.execute(preview.token)};
  }catch(e){if(preview)service.cancel(preview.token);return {ok:false,error:e.publicMessage||'Could not empty this folder. Refresh and check the provider before trying again.'};}finally{busy=false;}
 });
}
module.exports={createMailboxEmpty,registerMailboxEmpty,targetedExpunge};

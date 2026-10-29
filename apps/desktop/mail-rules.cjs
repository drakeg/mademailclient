const {randomUUID,createHash}=require('node:crypto');
const {fetchFolder}=require('./accounts.cjs');
const {writable}=require('./mail-actions.cjs');
const fail=message=>Object.assign(new Error(message),{publicMessage:message});
const ruleActions=new Set(['move','junk','trash','markRead','markUnread','flag']);
function normalizeRule(value){
 if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.length>150||typeof value.accountId!=='string'||!['all','any'].includes(value.match)||typeof value.enabled!=='boolean'||typeof value.stopProcessing!=='boolean')throw fail('Name the rule and select its account and match mode.');
 const conditions=list=>{
  if(!Array.isArray(list)||list.length>20)throw fail('Use up to 20 conditions/exceptions.');
  return list.map(c=>{if(!c||!['from','to','subject'].includes(c.field)||!['contains','equals'].includes(c.operator)||typeof c.value!=='string'||!c.value.trim()||c.value.length>1000)throw fail('Complete the rule conditions.');return {field:c.field,operator:c.operator,value:c.value};});
 };
 const conditionList=conditions(value.conditions),exceptions=conditions(value.exceptions||[]);
 if(!conditionList.length||!Array.isArray(value.actions)||value.actions.length!==1||!ruleActions.has(value.actions[0]?.type))throw fail('Choose a condition and one supported action.');
 const action={type:value.actions[0].type};if(action.type==='move'){if(typeof value.actions[0].value!=='string'||!value.actions[0].value||value.actions[0].value.length>1024||/[\r\n\0]/.test(value.actions[0].value))throw fail('Choose the destination folder.');action.value=value.actions[0].value;}
 return {name:value.name.trim(),accountId:value.accountId,match:value.match,conditions:conditionList,exceptions,actions:[action],enabled:value.enabled,stopProcessing:value.stopProcessing};
}
function createMailRules({vault,store,cursors,actions,resolveAccount=async a=>a,fetch=fetchFolder,now=Date.now}){
 let busy=false;const previews=new Map();
 const digest=rules=>createHash('sha256').update(JSON.stringify(rules)).digest('hex');
 async function account(id){const a=(await vault.list()).find(a=>a.id===id);if(!a)throw fail('Account no longer exists.');writable(a);return resolveAccount(a);}
 async function execute(a,messages,rules){
  const {planRules}=await import('../../packages/core/rules.mjs');let done=0,failed=0;
  for(const message of messages){
   if(digest((await store.list()).filter(r=>r.accountId===a.id))!==digest(rules))break;
   const plans=planRules({...message,from:message.email},rules);
   for(const plan of plans){
    const rule=rules.find(r=>r.id===plan.ruleId),action=plan.actions[0];
    const key='rule-'+createHash('sha256').update([a.id,message.path,message.validity,message.uid,rule.id,rule.revision].join('\0')).digest('hex');
    const result=await actions.apply({accountId:a.id,path:message.path,uid:message.uid,validity:message.validity,action:action.type,...(action.type==='move'?{destination:action.value}:{})},key);
    if(result.status==='done'){if(!result.replayed)done++;}else failed++;
    // A move invalidates the source UID. Do not execute another action on that source.
    if(['move','junk','trash'].includes(action.type)||result.status!=='done')break;
   }
  }
  return {done,failed};
 }
 return {
  async list(){return store.list();},
  async save(input){
   const next=normalizeRule(input);await account(next.accountId);const id=input.id||randomUUID();
   await store.update(all=>{
    if(input.id&&!all.some(r=>r.id===id))throw fail('Rule no longer exists.');if(!input.id&&all.length>=500)throw fail('The 500-rule limit was reached.');
    const rule={...next,id,revision:randomUUID()};return input.id?all.map(r=>r.id===id?rule:r):[...all,rule];
   });return {id};
  },
  async remove(id){await store.update(all=>all.filter(r=>r.id!==id));},
  async reorder(input){await store.update(all=>{const at=all.findIndex(r=>r.id===input.id),to=at+(input.direction==='up'?-1:input.direction==='down'?1:0);if(at<0||to<0||to>=all.length||at===to)throw fail('Cannot move this rule.');[all[at],all[to]]=[all[to],all[at]];return all;});},
  async preview(accountId){
   const a=await account(accountId),page=await fetch(a),rules=(await store.list()).filter(r=>r.accountId===a.id),{planRules}=await import('../../packages/core/rules.mjs');
   const matches=page.messages.filter(m=>planRules({...m,from:m.email},rules).length).map(m=>({subject:m.subject,uid:m.uid}));
   if(previews.size>=20)previews.clear();const token=randomUUID();previews.set(token,{accountId,revision:digest(rules),messages:page.messages,expires:now()+300000});
   return {token,total:page.messages.length,matches};
  },
  async run(token){
   if(busy)throw fail('Rules are already running.');busy=true;
   try{const preview=previews.get(token);previews.delete(token);if(!preview||preview.expires<now())throw fail('Preview expired. Preview again.');const a=await account(preview.accountId),rules=(await store.list()).filter(r=>r.accountId===a.id);if(digest(rules)!==preview.revision)throw fail('Rules changed. Preview again before applying.');return await execute(a,preview.messages,rules);}finally{busy=false;}
  },
  async processIncoming(a,page){
   if(busy)return false;busy=true;
   try{
    if(a.oauth&&a.oauth.provider!=='google')return false;
    const old=(await cursors.list()).find(c=>c.id===a.id),highest=Math.max(0,...page.messages.map(m=>m.uid));
    const save=()=>cursors.update(all=>[...all.filter(c=>c.id!==a.id),{id:a.id,validity:page.validity,highest:Math.max(old?.validity===page.validity?old.highest:0,highest)}]);
    if(!old||old.validity!==page.validity){await save();return false;}
    const rules=(await store.list()).filter(r=>r.accountId===a.id);
    let messages=[...page.messages],next=page.before;
    if(rules.some(r=>r.enabled))while(next&&messages.length&&Math.min(...messages.map(m=>m.uid))>old.highest){
     if(messages.length>=5000)throw fail('Automatic rule backlog exceeds 5,000 messages. Disable rules and refresh to start a new baseline, then review older mail manually.');
     const older=await fetch(a,{before:next,validity:page.validity});messages.push(...older.messages);next=older.before;
    }
    const fresh=messages.filter(m=>m.uid>old.highest).sort((x,y)=>x.uid-y.uid);
    const result=rules.length?await execute(a,fresh,rules):{done:0,failed:0};await save();
    if(result.failed)throw fail('Some rule actions failed or have an unknown outcome. Review Mailbox → Action History. No automatic retry was made.');
    return result.done>0;
   }finally{busy=false;}
  }
 };
}
function registerMailRules(ipcMain,getWindow,service){
 for(const name of ['list','save','remove','reorder','preview','run'])ipcMain.handle('rules:'+name,async(event,input)=>{
  const c=getWindow()?.webContents;if(!c||event.sender!==c||event.senderFrame!==c.mainFrame||event.senderFrame.url!=='mademail://app/')return {ok:false,error:'Unauthorized request'};
  try{return {ok:true,data:await service[name](input)};}catch(e){return {ok:false,error:e.publicMessage||'Rules operation failed. Check account settings and action history.'};}
 });
}
module.exports={createMailRules,registerMailRules,normalizeRule};

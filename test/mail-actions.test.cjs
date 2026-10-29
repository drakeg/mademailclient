const {test}=require('node:test');const assert=require('node:assert/strict');
const {createMailActions}=require('../apps/desktop/mail-actions.cjs');
const account={id:'a'};
function memory(data=[]){return {list:async()=>structuredClone(data),update:async fn=>{data=fn(structuredClone(data));}};}
const ref={requestId:'fixture-0001',accountId:'a',path:'INBOX',uid:8,validity:'9',action:'trash'};
function fixture({move=true,folder=true,validity='9',error=false}={}){
 let moves=0,deletes=0,flags=[];const journal=memory();
 const client={capabilities:new Set(move?['MOVE']:[]),mailbox:{uidValidity:validity},list:async()=>folder?[{path:'Deleted Items',specialUse:'\\Trash'}]:[],getMailboxLock:async()=>({release(){}}),fetchOne:async()=>({uid:8}),messageMove:async()=>{moves++;if(error)throw Error('lost');return true;},messageDelete:()=>deletes++,messageFlagsAdd:async(uid,f)=>{flags.push(...f);return true;}};
 return {journal,counts:()=>({moves,deletes,flags}),service:createMailActions({vault:memory([account]),journal,settings:memory(),connect:async(a,run)=>run(client)})};
}
test('delete moves only to server Trash, persists completion and never replays a request',async()=>{
 const f=fixture();assert.equal((await f.service.apply(ref)).status,'done');await f.service.apply(ref);assert.deepEqual(f.counts(),{moves:1,deletes:0,flags:[]});
 await assert.rejects(f.service.apply({...ref,uid:99}));
});
test('missing special folder, absent MOVE and stale UIDVALIDITY fail without destructive fallback',async()=>{
 for(const options of [{folder:false},{move:false},{validity:'10'}]){const f=fixture(options);assert.equal((await f.service.apply(ref)).status,'failed');assert.equal(f.counts().moves,0);assert.equal(f.counts().deletes,0);}
});
test('unknown MOVE outcome stays locked across retries',async()=>{
 const f=fixture({error:true});assert.equal((await f.service.apply(ref)).status,'unknown');await f.service.apply(ref);assert.equal(f.counts().moves,1);
});
test('read and flag use explicit idempotent flags, never expunge',async()=>{
 const f=fixture();assert.equal((await f.service.apply({...ref,action:'markRead'})).status,'done');assert.deepEqual(f.counts().flags,['\\Seen']);
});
test('mail action IPC rejects a different window before reaching provider operations',async()=>{
 const {registerMailActions}=require('../apps/desktop/mail-actions.cjs');const handlers={};const mainFrame={url:'mademail://app/'};const contents={mainFrame};let calls=0;
 registerMailActions({handle:(name,fn)=>handlers[name]=fn},()=>({webContents:contents}),{apply:async()=>calls++});
 assert.equal((await handlers['mail:apply']({sender:{},senderFrame:mainFrame},ref)).ok,false);assert.equal(calls,0);
});
test('explicit destination maps persist and must belong to the selected account',async()=>{
 const settings=memory(),client={list:async()=>[{path:'Bin',flags:new Set()}]};
 const service=createMailActions({vault:memory([account]),journal:memory(),settings,connect:async(a,run)=>run(client)});
 await service.saveSettings({accountId:'a',folders:{trash:'Bin'}});assert.equal((await service.getSettings())[0].folders.trash,'Bin');
 await assert.rejects(service.saveSettings({accountId:'a',folders:{trash:'OtherAccountFolder'}}));
});

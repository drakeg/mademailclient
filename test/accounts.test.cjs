const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createCipheriv,createDecipheriv,randomBytes}=require('node:crypto');
const {validateAccount,publicAddress,createVault,registerAccounts}=require('../apps/desktop/accounts.cjs');
test('account validation and network boundary reject local destinations and malformed values',()=>{
 for(const a of ['127.0.0.1','10.1.2.3','169.254.169.254','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1'])assert.equal(publicAddress(a),false,a);
 assert.equal(publicAddress('8.8.8.8'),true);
 for(const host of ['localhost','mail.local','https://mail.example.com','127.0.0.1','a.example.com\n'])assert.throws(()=>validateAccount({email:'x@example.com',host,username:'x',password:'secret'}));
 assert.equal(validateAccount({email:'x@example.com',host:'imap.example.com',username:'x',password:'secret'}).host,'imap.example.com');
});
test('vault encrypts accounts, serializes changes, preserves corrupt data and fails closed',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mademail-vault-'));const file=path.join(dir,'accounts.enc');const key=randomBytes(32);
 const crypto={isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async s=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const payload=Buffer.concat([c.update(s),c.final()]);return Buffer.concat([iv,c.getAuthTag(),payload]);},decryptStringAsync:async b=>{const d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return {result:Buffer.concat([d.update(b.subarray(28)),d.final()]).toString()};}};
 try{const vault=createVault(file,crypto);assert.deepEqual(await vault.list(),[]);await Promise.all([vault.update(a=>[...a,{id:'1',password:'never-plaintext'}]),vault.update(a=>[...a,{id:'2'}])]);assert.equal((await vault.list()).length,2);assert.equal((await fs.readFile(file)).includes('never-plaintext'),false);await vault.update(a=>a.filter(a=>a.id!=='1'));assert.equal((await vault.list()).length,1);await fs.writeFile(file,'corrupt');await assert.rejects(vault.update(()=>[]));assert.equal(await fs.readFile(file,'utf8'),'corrupt');await assert.rejects(createVault(file,{isAsyncEncryptionAvailable:async()=>false}).update(()=>[]));}finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('account IPC rejects another renderer and subframes without accessing credentials',async()=>{
 const handlers={};const contents={mainFrame:{url:'mademail://app/'}};registerAccounts({handle:(n,h)=>handlers[n]=h},()=>({webContents:contents}),{list:()=>{throw new Error('Should not access vault');}});
 assert.equal((await handlers['accounts:list']({sender:{},senderFrame:contents.mainFrame})).ok,false);
 assert.equal((await handlers['accounts:list']({sender:contents,senderFrame:{url:'mademail://app/'}})).ok,false);
});
test('IMAP sessions pin public addresses, validate TLS and select read-only without expunging',async()=>{
 const {withInbox}=require('../apps/desktop/accounts.cjs');const calls=[];let options;
 class Client{constructor(o){options=o;}on(){}async connect(){calls.push('connect');}async getMailboxLock(folder,opts){assert.equal(folder,'INBOX');assert.deepEqual(opts,{readOnly:true});return {release:()=>calls.push('release')};}async logout(){calls.push('logout');}close(){calls.push('close');}}
 const account={host:'imap.example.com',username:'test',password:'synthetic'};
 const deps={resolve:async()=>[{address:'8.8.8.8'}],Client};
 assert.equal(await withInbox(account,async()=>42,deps),42);
 assert.equal(options.host,'8.8.8.8');assert.equal(options.tls.servername,account.host);assert.equal(options.tls.rejectUnauthorized,true);assert.equal(options.secure,true);assert.equal(options.logger,false);assert.deepEqual(calls,['connect','release','logout']);
 await assert.rejects(withInbox(account,()=>{}, {...deps,resolve:async()=>[{address:'8.8.8.8'},{address:'127.0.0.1'}]}));
 await assert.rejects(withInbox(account,async()=>{throw new Error('fetch failed');},deps));assert.equal(calls.at(-2),'release');assert.equal(calls.at(-1),'logout');
});
test('opening a message during a slow account operation is accepted rather than rejected as busy',async()=>{
 const handlers={},contents={mainFrame:{url:'mademail://app/'}},event={sender:contents,senderFrame:contents.mainFrame};
 let release,entered;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
 const saved={id:'fixture',email:'me@example.com',host:'imap.example.com',username:'me'};let reads=0;
 const vault={list:async()=>{if(++reads===1){entered();await gate;}return [saved];}};
 registerAccounts({handle:(name,handler)=>handlers[name]=handler},()=>({webContents:contents}),vault,{readBody:async()=> 'Synthetic message body'});
 const refresh=handlers['accounts:list'](event);await started;
 const body=await handlers['accounts:body'](event,{accountId:'fixture',path:'INBOX',uid:1,validity:'1'});
 release();await refresh;assert.equal(body.ok,true,body.error);assert.equal(body.data,'Synthetic message body');
});
test('account request queues bound concurrency, prioritize pending body reads and recover after failure',async()=>{
 const {createOperationQueue}=require('../apps/desktop/accounts.cjs');const enqueue=createOperationQueue(1,4);let release;const gate=new Promise(resolve=>release=resolve),calls=[];
 const first=enqueue(async()=>{calls.push('first');await gate;throw Error('synthetic failure');});const rejected=assert.rejects(first);
 const background=enqueue(async()=>calls.push('background')),body=enqueue(async()=>calls.push('body'),1),last=enqueue(async()=>calls.push('last'));
 await assert.rejects(enqueue(async()=>calls.push('overflow')));release();await rejected;await Promise.all([background,body,last]);assert.deepEqual(calls,['first','body','background','last']);
});
test('queued account writes recheck the requesting window before execution',async()=>{
 const handlers={},contents={mainFrame:{url:'mademail://app/'}},event={sender:contents,senderFrame:contents.mainFrame};let open=true,release,entered,updates=0;
 const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
 registerAccounts({handle:(name,handler)=>handlers[name]=handler},()=>open?{webContents:contents}:undefined,{update:async()=>{updates++;entered();await gate;}});
 const first=handlers['accounts:remove'](event,'first');await started;const queued=handlers['accounts:remove'](event,'second');open=false;release();await first;
 const result=await queued;assert.equal(result.ok,false);assert.equal(result.code,'REQUEST_CANCELLED');assert.equal(updates,1);
});

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

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateAccount, accountSummary, registerAccounts, withInbox } = require('../apps/desktop/accounts.cjs');
const { discoverAccount } = require('../apps/desktop/account-discovery.cjs');
const { verifySmtp } = require('../apps/desktop/smtp.cjs');
const incoming = {email:'tester@example.com',host:'imap.example.com',username:'tester',password:'incoming-secret'};
const outgoing = {host:'smtp.example.com',port:587,security:'starttls',useIncomingAuth:false,username:'outgoing-user',password:'outgoing-secret'};

test('SMTP settings support separate credentials and expose no secrets', () => {
 const a = validateAccount({...incoming,smtp:outgoing});
 assert.equal(a.smtp.password,'outgoing-secret');
 assert.equal(a.smtp.username,'outgoing-user');
 const publicData=accountSummary({...a,id:'one'});
 assert.equal(publicData.smtp.host,'smtp.example.com');
 assert.equal(JSON.stringify(publicData).includes('secret'),false);
 const reused=validateAccount({...incoming,smtp:{...outgoing,useIncomingAuth:true}});
 assert.equal(reused.smtp.username,incoming.username);assert.equal(reused.smtp.password,incoming.password);
});
test('plaintext, mixed port/security combinations and invalid SMTP fields are rejected',()=>{
 for(const smtp of [{...outgoing,port:25},{...outgoing,security:'none'},{...outgoing,port:465},{...outgoing,host:'127.0.0.1'},{...outgoing,password:''},{...outgoing,useIncomingAuth:'true'}])assert.throws(()=>validateAccount({...incoming,smtp}));
 assert.equal(validateAccount(incoming).smtp,undefined,'Legacy incoming-only accounts stay valid');
 assert.equal(validateAccount({...incoming,port:143,security:'starttls'}).port,143);
 assert.throws(()=>validateAccount({...incoming,port:143,security:'tls'}));
});
test('SMTP verifies TLS/auth without sending and closes on success or failure',async()=>{
 let options,closed=false,verified=false;
 const createTransport=o=>{options=o;return {verify:async()=>{verified=true;},close:()=>{closed=true;},sendMail:()=>{throw new Error('Must never send');}};};
 await verifySmtp(outgoing,{resolve:async()=>[{address:'8.8.8.8'}],createTransport});
 assert.equal(verified,true);assert.equal(closed,true);assert.equal(options.host,'8.8.8.8');assert.equal(options.tls.servername,outgoing.host);assert.equal(options.requireTLS,true);assert.equal(options.secure,false);assert.equal(options.tls.rejectUnauthorized,true);assert.equal(options.logger,false);
 await assert.rejects(verifySmtp(outgoing,{resolve:async()=>[{address:'127.0.0.1'}],createTransport}));
 closed=false;await assert.rejects(verifySmtp(outgoing,{resolve:async()=>[{address:'8.8.8.8'}],createTransport:()=>({verify:async()=>{throw new Error('auth failed');},close:()=>{closed=true;}})}));assert.equal(closed,true);
});
test('known provider discovery needs no network and includes SMTP and auth guidance',async()=>{
 const r=await discoverAccount('SAMPLE@ICLOUD.COM',{resolveSrv:()=>{throw new Error('No DNS needed');}});
 assert.equal(r.imap.host,'imap.mail.me.com');assert.equal(r.smtp.host,'smtp.mail.me.com');assert.equal(r.smtp.port,587);assert.equal(r.smtp.security,'starttls');assert.equal(r.smtp.username,'SAMPLE@ICLOUD.COM');assert.equal(r.source,'Built-in provider settings');assert.equal(Object.hasOwn(r.imap,'password'),false);assert.equal(Object.hasOwn(r.smtp,'password'),false);
 const ms=await discoverAccount('sample@outlook.com');assert.equal(ms.requiresOAuth,true);
});
test('DNS discovery uses domain-only SRV queries, supports partial results and ignores unsafe endpoints',async()=>{
 const queries=[];
 const records={
  '_imaps._tcp.example.com':[{name:'imap.example.com.',port:993,priority:10,weight:0}],
  '_submissions._tcp.example.com':[{name:'127.0.0.1',port:465,priority:0,weight:0}],
  '_submission._tcp.example.com':[{name:'smtp.example.com.',port:587,priority:0,weight:0}]
 };
 const r=await discoverAccount('private-local-part@example.com',{resolveSrv:async name=>{queries.push(name);return records[name]||[];}});
 assert.equal(r.imap.host,'imap.example.com');assert.equal(r.smtp.host,'smtp.example.com');assert.equal(queries.some(q=>q.includes('private-local-part')),false);
 const none=await discoverAccount('sample@example.com',{resolveSrv:async()=>[]});assert.equal(none.imap,null);assert.equal(none.smtp,null);
 const partial=await discoverAccount('sample@example.com',{resolveSrv:async name=>name.startsWith('_imaps')?records['_imaps._tcp.example.com']:[]});assert.equal(partial.smtp,null);assert.ok(partial.imap);
 await assert.rejects(discoverAccount('bad\n@example.com'));
});
test('DNS failure and timeout produce manual fallback without authenticating',async()=>{
 for(const resolveSrv of [async()=>{throw new Error('DNS failed');},()=>new Promise(()=>{})]){
  const r=await discoverAccount('sample@example.com',{resolveSrv,timeoutMs:10});assert.equal(r.imap,null);assert.equal(r.smtp,null);
 }
});

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
function accountHarness(seed=[], overrides={}) {
 let records=structuredClone(seed),time=10000;
 const handlers={},contents={mainFrame:{url:'mademail://app/'}};
 const vault={list:async()=>structuredClone(records),update:async change=>{records=change(records);return records;}};
 const checks=[];
 registerAccounts({handle:(n,h)=>handlers[n]=h},()=>({webContents:contents}),vault,{now:()=>{time+=6000;return time;},testInbox:async a=>checks.push(['imap',a]),testSmtp:async s=>checks.push(['smtp',s]),...overrides});
 return {checks,records:()=>records,invoke:(name,input)=>handlers['accounts:'+name]({sender:contents,senderFrame:contents.mainFrame},input)};
}
test('saving verifies both servers before persisting and returns only public settings',async()=>{
 const h=accountHarness();const r=await h.invoke('add',{...incoming,smtp:outgoing});assert.equal(r.ok,true);assert.equal(h.records().length,1);assert.equal(h.checks.length,2);assert.equal(h.records()[0].smtp.password,'outgoing-secret');assert.equal(JSON.stringify(r).includes('secret'),false);
 const listed=await h.invoke('list');assert.equal(listed.data[0].smtp.port,587);assert.equal(JSON.stringify(listed).includes('secret'),false);
});
test('failed SMTP verification leaves the vault unchanged and reports SMTP failure without raw error',async()=>{
 const old={...incoming,id:'saved'};
 const h=accountHarness([old],{testSmtp:async()=>{throw new Error('secret and provider response');}});
 const r=await h.invoke('update',{...incoming,id:'saved',password:'',smtp:outgoing});
 assert.equal(r.ok,false);assert.equal(r.code,'SMTP_CHECK_FAILED');assert.equal(r.error.includes('secret'),false);assert.deepEqual(h.records(),[old]);
});
test('legacy accounts can add SMTP without re-entering unchanged incoming password',async()=>{
 const h=accountHarness([{...incoming,id:'saved'}]);
 const r=await h.invoke('update',{...incoming,id:'saved',password:'',smtp:{...outgoing,useIncomingAuth:true,password:''}});
 assert.equal(r.ok,true);assert.equal(r.data.id,'saved');assert.equal(h.records().length,1);assert.equal(h.records()[0].smtp.password,incoming.password);
});
test('blank edit passwords never transfer saved credentials to another host or username',async()=>{
 for(const change of [{host:'other.example.com'},{username:'other-user'}]){
  const h=accountHarness([{...incoming,id:'saved',smtp:outgoing}]);const r=await h.invoke('update',{...incoming,...change,id:'saved',password:'',smtp:outgoing});assert.equal(r.ok,false);assert.equal(h.checks.length,0);assert.equal(h.records()[0].host,incoming.host);
 }
 const h=accountHarness([{...incoming,id:'saved',smtp:outgoing}]);const r=await h.invoke('update',{...incoming,id:'saved',password:'',smtp:{...outgoing,host:'other.example.com',password:''}});assert.equal(r.ok,false);assert.equal(h.checks.length,0);
});
test('discovery IPC forwards only the email string and never reads the credential vault',async()=>{
 const h=accountHarness([],{discover:async email=>({imap:null,smtp:null,note:email})});const r=await h.invoke('discover','sample@example.com');assert.equal(r.ok,true);assert.equal(r.data.note,'sample@example.com');assert.equal(h.records().length,0);
});
test('SMTP refuses a STARTTLS downgrade before exposing credentials (real local protocol fixture)',async()=>{
 const net=require('node:net'),nodemailer=require('nodemailer');const commands=[],sockets=new Set();
 const server=net.createServer(socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});socket.write('220 fixture ESMTP\r\n');let buffer='';
  socket.on('data',data=>{buffer+=data;let i;while((i=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+2);commands.push(line.split(' ')[0]);if(line.startsWith('EHLO'))socket.write('250-fixture\r\n250 AUTH PLAIN LOGIN\r\n');else if(line==='STARTTLS')socket.write('454 TLS unavailable\r\n');else socket.write('500 unsupported\r\n');}});
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 try{await assert.rejects(verifySmtp(outgoing,{resolve:async()=>[{address:'8.8.8.8'}],createTransport:options=>nodemailer.createTransport({...options,host:'127.0.0.1',port:server.address().port})}));assert.ok(commands.includes('STARTTLS'));assert.equal(commands.includes('AUTH'),false);assert.equal(commands.includes('MAIL'),false);}finally{for(const s of sockets)s.destroy();await new Promise(resolve=>server.close(resolve));}
});
test('outgoing verification requires authentication even when a server omits AUTH capabilities',async()=>{
 let options;await verifySmtp(outgoing,{resolve:async()=>[{address:'8.8.8.8'}],createTransport:o=>{options=o;return {verify:async()=>{},close:()=>{}};}});assert.equal(options.forceAuth,true);
});
test('DNS timeout on one service preserves settings already found for another',async()=>{
 const r=await discoverAccount('sample@example.com',{timeoutMs:10,resolveSrv:async name=>name.startsWith('_imaps')?[{name:'imap.example.com',port:993,priority:0,weight:0}]:new Promise(()=>{})});assert.equal(r.imap?.host,'imap.example.com');assert.equal(r.smtp,null);
});

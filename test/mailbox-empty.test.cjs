const {test}=require('node:test'),assert=require('node:assert/strict');
const {createMailboxEmpty,registerMailboxEmpty,targetedExpunge}=require('../apps/desktop/mailbox-empty.cjs');
const account={id:'a',email:'owner@example.com',host:'imap.example.com',username:'owner'},input={accountId:'a',role:'trash'};
function memory(rows=[]){let queue=Promise.resolve();return {list:async()=>{await queue;return structuredClone(rows);},update(fn){const t=queue.then(()=>{rows=fn(structuredClone(rows));});queue=t.catch(()=>{});return t;}};}
function fixture(options={}){
 let uids=[2,4,8],validity='9',now=1000,flags=[],commands=[],mapping={trash:'Trash'},listed=[{path:'INBOX',specialUse:'\\Inbox'},{path:'Trash',specialUse:'\\Trash'},{path:'Junk',specialUse:'\\Junk'}];const journal=memory(),vault=memory([account]);
 const c={capabilities:new Set(options.noUidPlus?[]:['UIDPLUS']),mailbox:{uidValidity:'9',readOnly:false},list:async()=>listed,getMailboxLock:async(path,o)=>{c.mailbox.uidValidity=validity;c.mailbox.readOnly=!!options.readOnly&&!o.readOnly;return {release(){}};},search:async()=>uids,exec:async(command,args)=>{commands.push({command,args});if(options.disconnect)throw Error('connection lost');return {response:{command:'OK'},next(){}};},messageFlagsAdd:async(ids,f,o)=>{flags.push({ids,f,o});if(options.dropCapability)c.capabilities.clear();return true;}};
 const service=createMailboxEmpty({vault,journal,settings:{list:async()=>[{id:'a',folders:mapping}]},connect:async(_a,run)=>run(c),now:()=>now});
 return {service,journal,vault,c,flags,commands,setUids:v=>uids=v,setValidity:v=>validity=v,setTime:v=>now=v,setMapping:v=>mapping=v,setFolders:v=>listed=v};
}
test('empty targets only previewed UIDs, preserves later arrivals and consumes its preview once',async()=>{
 const f=fixture(),p=await f.service.preview(input);assert.equal(p.count,3);assert.equal(p.path,'Trash');f.setUids([2,4,8,99]);
 const result=await f.service.execute(p.token);assert.equal(result.status,'done');assert.deepEqual(f.flags[0].ids,[2,4,8]);assert.deepEqual(f.commands,[{command:'UID EXPUNGE',args:[{type:'SEQUENCE',value:'2,4,8'}]}]);
 await assert.rejects(f.service.execute(p.token));assert.equal(f.commands.length,1);assert.equal((await f.journal.list())[0].status,'done');
});
test('no UIDPLUS, Inbox mappings, wrong roles, expired and changed previews never expunge',async()=>{
 const unsupported=fixture({noUidPlus:true});await assert.rejects(unsupported.service.preview(input));assert.equal(unsupported.flags.length,0);
 const inbox=fixture();inbox.setMapping({trash:'INBOX'});await assert.rejects(inbox.service.preview(input));assert.equal(inbox.flags.length,0);
 const wrong=fixture();await assert.rejects(wrong.service.preview({...input,role:'inbox'}));
 for(const change of [f=>f.setValidity('10'),f=>f.setMapping({trash:'Junk'}),f=>f.setTime(301001)]){const f=fixture(),p=await f.service.preview(input);change(f);await assert.rejects(f.service.execute(p.token));assert.equal(f.flags.length,0);assert.equal(f.commands.length,0);}
});
test('read-only grants and account identity changes cannot execute an approved preview',async()=>{
 const readOnly=fixture({readOnly:true}),p=await readOnly.service.preview(input);await assert.rejects(readOnly.service.execute(p.token));assert.equal(readOnly.commands.length,0);
 const f=fixture(),preview=await f.service.preview(input);await f.vault.update(all=>all.map(a=>({...a,host:'other.example.com'})));await assert.rejects(f.service.execute(preview.token));assert.equal(f.commands.length,0);
 const yahoo=fixture();await yahoo.vault.update(all=>all.map(a=>({...a,oauth:{provider:'yahoo'}})));await assert.rejects(yahoo.service.preview(input));
});
test('capability loss never becomes broad EXPUNGE; ambiguous outcomes are journaled without replay',async()=>{
 const f=fixture({dropCapability:true,disconnect:true}),p=await f.service.preview(input),r=await f.service.execute(p.token);assert.equal(r.status,'unknown');assert.equal(f.commands[0].command,'UID EXPUNGE');await assert.rejects(f.service.execute(p.token));assert.equal(f.commands.length,1);assert.equal((await f.journal.list())[0].status,'unknown');
});
test('canceled and unauthorized native confirmations never execute',async()=>{
 const handlers={},contents={mainFrame:{url:'mademail://app/'}},win={webContents:contents};let executes=0,cancels=0,options;
 registerMailboxEmpty({handle:(n,h)=>handlers[n]=h},()=>win,{preview:async()=>({token:'fixture',account:'owner@example.com',path:'Trash',role:'trash',count:3}),cancel:()=>cancels++,execute:async()=>executes++},{showMessageBox:async(_w,o)=>{options=o;return {response:0};}});
 const event={sender:contents,senderFrame:contents.mainFrame};assert.equal((await handlers['mail:empty']({sender:{},senderFrame:contents.mainFrame},input)).ok,false);
 assert.equal((await handlers['mail:empty'](event,input)).data.status,'cancelled');assert.equal(executes,0);assert.equal(cancels,1);assert.equal(options.defaultId,0);assert.equal(options.cancelId,0);assert.match(options.detail,/Trash/);assert.match(options.detail,/3/);assert.match(options.detail,/cannot be undone/i);
});
test('empty folders, bounded batches and oversized snapshots',async()=>{
 const empty=fixture();empty.setUids([]);const p=await empty.service.preview(input);assert.equal(p.count,0);assert.equal((await empty.service.execute(p.token)).status,'done');assert.equal(empty.commands.length,0);
 const many=fixture();many.setUids(Array.from({length:501},(_,i)=>i+1));await many.service.execute((await many.service.preview(input)).token);assert.equal(many.commands.length,2);assert.equal(many.flags[0].ids.length,500);assert.deepEqual(many.flags[1].ids,[501]);
 const huge=fixture();huge.setUids(Array.from({length:5001},(_,i)=>i+1));await assert.rejects(huge.service.preview(input));assert.equal(huge.flags.length,0);
});
test('account removal and failed durable claim stop deletion before flags',async()=>{
 const f=fixture(),p=await f.service.preview(input);await f.vault.update(()=>[]);await assert.rejects(f.service.execute(p.token));assert.equal(f.flags.length,0);
 const full=fixture(),preview=await full.service.preview(input);full.journal.update=async()=>{throw Error('disk full');};await assert.rejects(full.service.execute(preview.token));assert.equal(full.flags.length,0);
});
test('targeted expunge emits UID syntax through real ImapFlow protocol without broad fallback',async()=>{
 const net=require('node:net'),{ImapFlow}=require('imapflow');let wire='',socket;
 const server=net.createServer(s=>{socket=s;s.setEncoding('utf8');s.write('* OK [CAPABILITY IMAP4rev1 UIDPLUS] fixture\r\n');let buffer='';s.on('data',chunk=>{wire+=chunk;buffer+=chunk;while(buffer.includes('\r\n')){const end=buffer.indexOf('\r\n'),line=buffer.slice(0,end);buffer=buffer.slice(end+2);const [tag,...parts]=line.split(' '),cmd=parts.join(' ');if(/^CAPABILITY/i.test(cmd))s.write('* CAPABILITY IMAP4rev1 UIDPLUS\r\n');if(/^LOGOUT/i.test(cmd)){s.end('* BYE\r\n'+tag+' OK goodbye\r\n');return;}s.write(tag+' OK done\r\n');}});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const c=new ImapFlow({host:'127.0.0.1',port:server.address().port,secure:false,doSTARTTLS:false,auth:{user:'fixture',pass:'synthetic'},logger:false,disableAutoIdle:true});c.on('error',()=>{});
 try{await c.connect();await targetedExpunge(c,[2,4,8]);assert.match(wire,/UID EXPUNGE 2,4,8\r\n/);assert.doesNotMatch(wire,/\r\n\S+ EXPUNGE\r\n/);}finally{c.close();socket?.destroy();await new Promise(r=>server.close(r));}
});

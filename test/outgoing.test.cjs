const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateDraft,createOutgoing,submitMessage,saveSentCopy,registerOutgoing}=require('../apps/desktop/outgoing.cjs');
const account={id:'a',email:'sender@example.com',smtp:{host:'smtp.example.com',username:'sender',password:'fixture'}};
const draft={accountId:'a',to:'friend@example.com',cc:'',bcc:'hidden@example.com',subject:'Hello',text:'Synthetic text'};
function memory(initial=[]){let data=structuredClone(initial),queue=Promise.resolve();return {list:async()=>{await queue;return structuredClone(data);},update(fn){const task=queue.then(()=>{data=fn(structuredClone(data));});queue=task.catch(()=>{});return task;}};}
test('draft boundary rejects header injection and address ambiguity; ignores untrusted raw/attachments/from',()=>{
 for(const change of [{to:'a@example.com\r\nBcc:x@example.com'},{to:'Name <a@example.com>'},{subject:'x\r\nBcc:x@example.com'},{text:'\0'}])assert.throws(()=>validateDraft({...draft,...change}));
 const valid=validateDraft({...draft,from:'spoof@example.com',raw:{path:'/private/fixture'},attachments:[{path:'/fixture'}]});assert.equal(valid.raw,undefined);assert.equal(valid.from,undefined);assert.equal(valid.attachments,undefined);
});
test('SMTP acceptance is durable before Sent copy; a failed copy and restarts never resubmit',async()=>{
 const journal=memory(),vault=memory([account]);let submits=0;
 const options={vault,journal,submit:async()=>{submits++;return {raw:Buffer.from('fixture'),partial:true,messageId:'<fixture@local>'};},saveCopy:async()=>{assert.equal((await journal.list())[0].status,'accepted');throw new Error('IMAP offline');}};
 const service=createOutgoing(options),{id}=await service.save(draft);
 assert.deepEqual(await service.send(id),{status:'accepted',partial:true,copy:'unavailable'});
 await assert.rejects(createOutgoing(options).send(id));assert.equal(submits,1);
 await assert.rejects(service.save({...draft,id}));
});
test('ambiguous SMTP failure stays locked across restart; drafts can be saved/discarded',async()=>{
 const journal=memory(),vault=memory([account]);let submits=0;
 const options={vault,journal,submit:async()=>{submits++;throw new Error('socket lost');}};
 const service=createOutgoing(options),{id}=await service.save(draft);assert.deepEqual(await service.send(id),{status:'unknown'});
 await assert.rejects(createOutgoing(options).send(id));assert.equal(submits,1);
 const {id:other}=await service.save({...draft,to:''});await assert.rejects(service.send(other));await service.discard(other);
 assert.equal((await service.list()).length,1);
});
test('SMTP MIME uses account sender, includes Bcc only in envelope, and closes transport',async()=>{
 let payload,closed=false;
 const r=await submitMessage(account,{...validateDraft(draft),id:'fixture'}, {smtp:async()=>({sendMail:async message=>{payload=message;return {accepted:['friend@example.com','hidden@example.com'],rejected:[]};},close(){closed=true;}})});
 assert.equal(payload.envelope.from,account.email);assert.ok(payload.envelope.to.includes('hidden@example.com'));assert.doesNotMatch(r.raw.toString(),/^Bcc:/mi);assert.match(r.raw.toString(),/^From: sender@example.com/mi);assert.equal(closed,true);
});
test('Sent copy uses only special-use Sent; Gmail avoids duplicate copies',async()=>{
 assert.equal(await saveSentCopy({...account,smtp:{host:'smtp.gmail.com'}},Buffer.from('x')), 'provider-managed');
 assert.equal(await saveSentCopy(account,Buffer.from('x'),{connect:async(a,run)=>run({list:async()=>[{path:'Trash',specialUse:'\\Trash'}],append:()=>assert.fail('must not guess a folder')})}), 'unavailable');
});
test('outgoing IPC rejects other origins before touching the service',async()=>{
 const handlers={};const mainFrame={url:'mademail://app/'};const sender={mainFrame};let calls=0;
 registerOutgoing({handle:(name,fn)=>handlers[name]=fn},()=>({webContents:sender}),{send:async()=>{calls++;}});
 assert.equal((await handlers['outgoing:send']({sender:{},senderFrame:mainFrame},'id')).ok,false);assert.equal(calls,0);
});
test('editing a draft during credential refresh prevents stale submission',async()=>{
 const journal=memory(),vault=memory([account]);let release,entered;
 const gate=new Promise(resolve=>release=resolve),start=new Promise(resolve=>entered=resolve);let submits=0;
 const service=createOutgoing({vault,journal,resolveAccount:async a=>{entered();await gate;return a;},submit:async()=>{submits++;}});
 const {id}=await service.save(draft);const sending=service.send(id);await start;
 await service.save({...draft,id,subject:'Edited before submission'});release();
 await assert.rejects(sending);assert.equal(submits,0);assert.equal((await service.list())[0].status,'draft');
});
test('a crash-persisted sending record is unknown and is never eligible to send',async()=>{
 const service=createOutgoing({vault:memory([account]),journal:memory([{...validateDraft(draft),id:'interrupted',status:'sending'}])});
 assert.equal((await service.list())[0].status,'unknown');await assert.rejects(service.send('interrupted'));
});

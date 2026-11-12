const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),{join}=require('node:path'),{tmpdir}=require('node:os');
const {createHash}=require('node:crypto');
const {simpleParser}=require('mailparser');
const {createOutgoing,submitMessage,registerOutgoing}=require('../apps/desktop/outgoing.cjs');
const {MAX_SEND_BYTES}=require('../apps/desktop/outgoing-files.cjs');
function memory(initial=[]){let data=structuredClone(initial),queue=Promise.resolve();return {list:async()=>{await queue;return structuredClone(data);},update(fn){const task=queue.then(()=>{data=fn(structuredClone(data));});queue=task.catch(()=>{});return task;}};}
const account={id:'a',email:'sender@example.com',smtp:{host:'smtp.example.com'}},draft={accountId:'a',to:'friend@example.com',subject:'Files',text:'Fictional files attached.'};
test('selected file bytes persist with draft, survive restart, stay out of IPC, and are sent in MIME',async()=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'mademail-send-files-'));try{
  const filename=join(dir,'notes.bin'),bytes=Buffer.from([0,1,255,10]);await fs.writeFile(filename,bytes);
  const journal=memory(),vault=memory([account]),service=createOutgoing({journal,vault});const {id}=await service.save(draft);
  await service.attachFiles(id,[filename]);await service.save({...draft,id,attachments:[{path:'/forged'}]});
  const reopened=createOutgoing({journal,vault}),record=(await reopened.list())[0];assert.equal(record.attachments.length,1);assert.equal(record.attachments[0].filename,'notes.bin');assert.equal(record.attachments[0].data,undefined);assert.equal(JSON.stringify(record).includes(dir),false);
  const stored=(await journal.list())[0];assert.deepEqual(Buffer.from(stored.attachments[0].data,'base64'),bytes);
  let payload;await submitMessage(account,stored,{smtp:async()=>({sendMail:async value=>{payload=value;return {accepted:['friend@example.com']};},close(){}})});
  const parsed=await simpleParser(payload.raw);assert.deepEqual(parsed.attachments[0].content,bytes);
  await reopened.removeAttachment({id,attachmentId:record.attachments[0].id});assert.equal((await reopened.list())[0].attachments.length,0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('file selection is atomic and bounded; directories, closed requesters and stale drafts add nothing',async()=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'mademail-send-bounds-'));try{
  const large=join(dir,'large.bin');await fs.writeFile(large,'');await fs.truncate(large,MAX_SEND_BYTES+1);
  const service=createOutgoing({journal:memory(),vault:memory([account])}),{id}=await service.save(draft);
  await assert.rejects(service.attachFiles(id,[large]));await assert.rejects(service.attachFiles(id,[dir]));await assert.rejects(service.attachFiles(id,[large],()=>false));assert.equal((await service.list())[0].attachments.length,0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('forwarding verifies original bytes and blocks submission until a failed import is explicitly resolved',async()=>{
 const bytes=Buffer.from('Original attachment'),digest=createHash('sha256').update(bytes).digest('hex');
 const journal=memory(),vault=memory([account]);let unavailable=true,submits=0;
 const service=createOutgoing({journal,vault,readContent:async()=>{if(unavailable)throw Error('offline');return {attachments:[{index:0,filename:'original.txt',contentType:'text/plain',size:bytes.length,digest,content:bytes}]};},submit:async()=>{submits++;return {raw:Buffer.from('test'),messageId:'<test@local>'};},saveCopy:async()=> 'saved'});
 const {id}=await service.save(draft),input={id,source:{accountId:'a',path:'INBOX',uid:1,validity:'1'},attachments:[{index:0,digest}]};
 await assert.rejects(service.forwardAttachments(input));await service.save({...draft,id});await assert.rejects(service.send(id));assert.equal(submits,0);assert.equal((await service.list())[0].pendingForward,true);
 unavailable=false;await service.forwardAttachments(input);assert.equal((await service.list())[0].pendingForward,false);assert.equal((await service.list())[0].attachments[0].filename,'original.txt');await service.send(id);assert.equal(submits,1);
 const {id:other}=await service.save(draft);await assert.rejects(service.forwardAttachments({...input,id:other,attachments:[{index:0,digest:'0'.repeat(64)}]}));await service.clearForwardPending(other);await service.send(other);assert.equal(submits,2);
});
test('native attachment picker ignores renderer file paths and cancels when window closes',async()=>{
 const handlers={},contents={mainFrame:{url:'mademail://app/'}},win={webContents:contents};let current=win,calls=0;
 registerOutgoing({handle:(name,fn)=>handlers[name]=fn},()=>current,{attachFiles:async(id,paths)=>{calls++;assert.equal(id,'draft');assert.deepEqual(paths,['/native/selection']);return {id,attachments:[]};}},{dialog:{showOpenDialog:async()=>({canceled:false,filePaths:['/native/selection']})}});
 const event={sender:contents,senderFrame:contents.mainFrame};assert.equal((await handlers['outgoing:chooseAttachments']({sender:{},senderFrame:contents.mainFrame},'draft')).ok,false);
 assert.equal((await handlers['outgoing:chooseAttachments'](event,'draft')).ok,true);assert.equal(calls,1);
 current=null;assert.equal((await handlers['outgoing:chooseAttachments'](event,'draft')).ok,false);assert.equal(calls,1);
});
test('a delayed file import cannot overwrite a concurrently edited draft',async()=>{
 let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r),journal=memory();
 const service=createOutgoing({journal,vault:memory([account]),readFiles:async()=>{enter();await gate;return [];} });
 const {id}=await service.save(draft),adding=service.attachFiles(id,['native-picker-only']);await entered;await service.save({...draft,id,subject:'Edited while importing'});release();await assert.rejects(adding,e=>e.publicCode==='DRAFT_CHANGED');assert.equal((await service.list())[0].subject,'Edited while importing');
});
test('saved forward intent survives restart and cannot be cleared by ordinary draft saves',async()=>{
 const source={source:{accountId:'a',path:'INBOX',uid:1,validity:'1'},attachments:[{index:0,digest:'a'.repeat(64)}]},journal=memory(),options={journal,vault:memory([account])};
 const {id}=await createOutgoing(options).save({...draft,forwardSource:source});const restarted=createOutgoing(options);await restarted.save({...draft,id,pendingForward:false});
 const record=(await restarted.list())[0];assert.equal(record.pendingForward,true);assert.deepEqual(record.forwardSource,source);await assert.rejects(restarted.send(id),e=>e.publicCode==='FORWARD_INCOMPLETE');
});
test('closing a window during the picker prevents attaching its selection',async()=>{
 const handlers={},contents={mainFrame:{url:'mademail://app/'}};let current={webContents:contents},calls=0;
 registerOutgoing({handle:(n,h)=>handlers[n]=h},()=>current,{attachFiles:async()=>{calls++;}},{dialog:{showOpenDialog:async()=>{current=null;return {canceled:false,filePaths:['/never/read']};}}});
 const result=await handlers['outgoing:chooseAttachments']({sender:contents,senderFrame:contents.mainFrame},'draft');assert.equal(result.ok,false);assert.equal(calls,0);
});
test('adding other files does not clear a failed forward import; aggregate storage limits preserve records',async()=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'mademail-forward-files-'));try{
  const file=join(dir,'note.txt');await fs.writeFile(file,'x');const journal=memory(),service=createOutgoing({journal,vault:memory([account])});
  const {id}=await service.save({...draft,forwardSource:{source:{accountId:'a',path:'INBOX',uid:1,validity:'1'},attachments:[{index:0,digest:'a'.repeat(64)}]}});
  await service.attachFiles(id,[file]);assert.equal((await service.list())[0].pendingForward,true);await assert.rejects(service.send(id),e=>e.publicCode==='FORWARD_INCOMPLETE');
  await journal.update(all=>[...all,...Array.from({length:4},(_,i)=>({id:'full-'+i,attachments:[{size:MAX_SEND_BYTES}]}))]);
  await assert.rejects(service.attachFiles(id,[file]),e=>e.publicCode==='ATTACHMENT_STORAGE_FULL');assert.equal((await service.list())[0].attachments.length,1);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

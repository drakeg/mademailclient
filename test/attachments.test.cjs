const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {readMessageContent,publicContent,safeFilename,MAX_SOURCE}=require('../apps/desktop/incoming.cjs');
const {registerAttachments}=require('../apps/desktop/attachments.cjs');
const raw=Buffer.from('From: sender@example.com\r\nTo: owner@example.com\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="fixture"\r\n\r\n--fixture\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nFictional invoice attached.\r\n--fixture\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename="invoice.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nSGVsbG8AYXR0YWNobWVudAo=\r\n--fixture--\r\n');
const ref={accountId:'fixture',path:'INBOX',uid:7,validity:'12'};
function mailbox({validity='12',size=raw.length,source=raw}={}){return async(_a,path,run)=>{assert.equal(path,'INBOX');return run({mailbox:{uidValidity:validity},fetchOne:async(uid,q,o)=>{assert.equal(uid,7);assert.deepEqual(o,{uid:true});return q.size?{size}:source===null?false:{source};}});};}
test('received MIME exposes text and attachment metadata without transferring bytes to renderer',async()=>{
 const content=await readMessageContent({},ref,{withMailbox:mailbox()});
 assert.match(content.text,/Fictional invoice/);assert.equal(content.attachments[0].content.toString(),'Hello\u0000attachment\n');
 const view=publicContent(content);assert.equal(view.attachments[0].filename,'invoice.txt');assert.equal(view.attachments[0].size,17);assert.match(view.attachments[0].digest,/^[a-f0-9]{64}$/);assert.equal(view.attachments[0].content,undefined);assert.equal(JSON.stringify(view).includes('SGVsbG8'),false);
});
test('stale, missing and oversized sources fail before parsing partial MIME',async()=>{
 await assert.rejects(readMessageContent({},ref,{withMailbox:mailbox({validity:'13'})}),e=>e.publicCode==='STALE_MESSAGE');
 await assert.rejects(readMessageContent({},ref,{withMailbox:mailbox({size:MAX_SOURCE+1})}),e=>e.publicCode==='MESSAGE_TOO_LARGE');
 await assert.rejects(readMessageContent({},ref,{withMailbox:mailbox({source:null})}),e=>e.publicCode==='MESSAGE_GONE');
 await assert.rejects(readMessageContent({},ref,{withMailbox:mailbox({source:Buffer.alloc(MAX_SOURCE+1)})}),e=>e.publicCode==='MESSAGE_TOO_LARGE');
});
test('attachment filenames cannot supply directories, controls, reserved device names or excessive bytes',()=>{
 assert.equal(safeFilename('../../outside.txt'),'outside.txt');assert.equal(safeFilename('C:\\Users\\other\\report.pdf'),'report.pdf');assert.equal(safeFilename('report\u202e\u0000.txt'),'report.txt');assert.equal(safeFilename('CON.txt'),'attachment-CON.txt');assert.equal(safeFilename('...'),'attachment');assert.ok(Buffer.byteLength(safeFilename('😀'.repeat(200)+'.txt'))<=180);
});
function ipcFixture({content,choosePath,writeFile}={}){
 const handlers={},contents={mainFrame:{url:'mademail://app/'}},win={webContents:contents,isDestroyed:()=>false};let current=win;
 registerAttachments({handle:(n,h)=>handlers[n]=h},()=>current,{list:async()=>[{id:'fixture',password:'never-rendered'}]},{showSaveDialog:choosePath||(async()=>({canceled:true}))},{readContent:async()=>content,writeFile});
 return {save:input=>handlers['attachments:save']({sender:contents,senderFrame:contents.mainFrame},input),unauthorized:()=>handlers['attachments:save']({sender:{},senderFrame:contents.mainFrame},ref),close:()=>{current=null;}};
}
test('saving writes exact decoded bytes to a native-dialog destination, never a renderer path',async()=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'mademail-attachment-'));try{
  const content=await readMessageContent({},ref,{withMailbox:mailbox()}),attachment=publicContent(content).attachments[0],target=join(dir,'chosen.txt'),outside=join(dir,'forged.txt');
  const ipc=ipcFixture({content,choosePath:async(_w,options)=>{assert.equal(options.defaultPath,'invoice.txt');return {canceled:false,filePath:target};}});
  assert.equal((await ipc.unauthorized()).ok,false);
  const result=await ipc.save({...ref,...attachment,filePath:outside});assert.equal(result.ok,true);assert.deepEqual(await fs.readFile(target),content.attachments[0].content);await assert.rejects(fs.stat(outside),{code:'ENOENT'});
  const again=await ipc.save({...ref,...attachment});assert.equal(again.ok,false);assert.equal(again.code,'ATTACHMENT_EXISTS');assert.deepEqual(await fs.readFile(target),content.attachments[0].content);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('cancel, altered digest and closed requester never write a file',async()=>{
 const content=await readMessageContent({},ref,{withMailbox:mailbox()}),attachment=publicContent(content).attachments[0];let writes=0;
 const cancelled=ipcFixture({content,writeFile:async()=>{writes++;}});assert.equal((await cancelled.save({...ref,...attachment})).data.canceled,true);
 assert.equal((await cancelled.save({...ref,...attachment,digest:'0'.repeat(64)})).code,'ATTACHMENT_CHANGED');
 let closed;closed=ipcFixture({content,choosePath:async()=>{closed.close();return {canceled:false,filePath:'/never/write'};},writeFile:async()=>{writes++;}});assert.equal((await closed.save({...ref,...attachment})).code,'REQUEST_CANCELLED');assert.equal(writes,0);
});
test('saving refuses an existing symlink rather than overwriting its target',async()=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'mademail-attachment-link-'));try{
  const target=join(dir,'original.txt'),link=join(dir,'selected.txt');await fs.writeFile(target,'unchanged');
  // Windows link creation needs privileges unavailable on standard CI runners.
  // The portable EEXIST case is covered above; exercise symlink behavior on Unix.
  if(process.platform==='win32')return;
  await fs.symlink(target,link);
  const content=await readMessageContent({},ref,{withMailbox:mailbox()}),attachment=publicContent(content).attachments[0];
  const ipc=ipcFixture({content,choosePath:async()=>({canceled:false,filePath:link})});assert.equal((await ipc.save({...ref,...attachment})).code,'ATTACHMENT_EXISTS');assert.equal(await fs.readFile(target,'utf8'),'unchanged');assert.equal((await fs.lstat(link)).isSymbolicLink(),true);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('invalid references and changed source sizes are rejected without saving partial data',async()=>{
 for(const patch of [{uid:0},{uid:1.5},{validity:'../12'},{path:'INBOX\u0000other'},{accountId:''}])await assert.rejects(readMessageContent({},{...ref,...patch},{withMailbox:mailbox()}),e=>e.publicCode==='INVALID_MESSAGE');
 await assert.rejects(readMessageContent({},ref,{withMailbox:mailbox({size:raw.length+10})}),e=>e.publicCode==='MESSAGE_CHANGED');
});

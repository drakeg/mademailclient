const fs=require('node:fs/promises'),{constants}=require('node:fs');
const {basename}=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const {safeFilename,fail}=require('./incoming.cjs');
const MAX_SEND_BYTES=10*1024*1024,MAX_STORED_BYTES=40*1024*1024,MAX_FILES=10;
function checkFiles(files){
 if(files.length>MAX_FILES||files.reduce((sum,a)=>sum+a.size,0)>MAX_SEND_BYTES)throw fail('ATTACHMENT_LIMIT','Limit outgoing mail to 10 attachments totaling 10 MB.');
}
function encodeAttachment(filename,bytes,contentType='application/octet-stream'){
 return {id:randomUUID(),filename:safeFilename(filename),size:bytes.length,contentType:/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(contentType)?contentType:'application/octet-stream',digest:createHash('sha256').update(bytes).digest('hex'),data:bytes.toString('base64')};
}
async function readSelectedFiles(paths,guard){
 if(!Array.isArray(paths)||paths.length>MAX_FILES)throw fail('ATTACHMENT_LIMIT','Choose at most 10 files.');
 const result=[];let total=0;
 for(const path of paths){
  if(!guard())throw fail('REQUEST_CANCELLED','The requesting window closed.');
  const handle=await fs.open(path,constants.O_RDONLY|(constants.O_NONBLOCK||0));
  try{
   const before=await handle.stat();if(!before.isFile())throw fail('INVALID_FILE','Choose regular files, not directories or special files.');
   if(before.size+total>MAX_SEND_BYTES)throw fail('ATTACHMENT_LIMIT','Limit outgoing attachments to 10 MB total.');
   const chunks=[];let size=0;
   while(true){
    if(!guard())throw fail('REQUEST_CANCELLED','The requesting window closed.');
    const buffer=Buffer.alloc(Math.min(65536,MAX_SEND_BYTES-total-size+1)),{bytesRead}=await handle.read(buffer,0,buffer.length,null);
    if(!bytesRead)break;size+=bytesRead;if(total+size>MAX_SEND_BYTES)throw fail('ATTACHMENT_LIMIT','Limit outgoing attachments to 10 MB total.');chunks.push(buffer.subarray(0,bytesRead));
   }
   const after=await handle.stat();if(before.size!==size||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw fail('FILE_CHANGED','A selected file changed while reading it. Select it again.');
   result.push(encodeAttachment(basename(path),Buffer.concat(chunks)));total+=size;
  }finally{await handle.close();}
 }
 return result;
}
const publicRecord=record=>({...record,attachments:(record.attachments||[]).map(({data,...a})=>a)});
function mimeAttachments(record){return (record.attachments||[]).map(a=>{
 const content=Buffer.from(a.data,'base64');if(content.length!==a.size||createHash('sha256').update(content).digest('hex')!==a.digest)throw fail('ATTACHMENT_CORRUPT','A saved attachment could not be verified.');
 return {filename:a.filename,content,contentType:a.contentType,contentDisposition:'attachment'};
});}
module.exports={MAX_SEND_BYTES,MAX_STORED_BYTES,MAX_FILES,checkFiles,encodeAttachment,readSelectedFiles,publicRecord,mimeAttachments};

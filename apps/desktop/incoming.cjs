// MIME bytes remain in the main process. Only text and bounded metadata cross IPC.
const {simpleParser}=require('mailparser');
const {createHash}=require('node:crypto');
const MAX_SOURCE=25*1024*1024,MAX_ATTACHMENT=20*1024*1024;
const fail=(code,message)=>Object.assign(new Error(message),{publicCode:code,publicMessage:message});
function messageReference(input){
 if(!input||typeof input.accountId!=='string'||!input.accountId||input.accountId.length>200||!Number.isSafeInteger(input.uid)||input.uid<1||typeof input.validity!=='string'||!/^\d{1,30}$/.test(input.validity)||typeof input.path!=='string'||!input.path||input.path.length>1024||/[\x00-\x1f\x7f]/.test(input.path))throw fail('INVALID_MESSAGE','Refresh the folder and select a message.');
 return {accountId:input.accountId,path:input.path,uid:input.uid,validity:input.validity};
}
function safeFilename(value){
 let name=String(value||'attachment').split(/[\\/]/).at(-1).replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g,'').replace(/[<>:"|?*]/g,'_').replace(/[. ]+$/g,'').trim();
 if(!name||/^\.+$/.test(name))name='attachment';
 if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='attachment-'+name;
 let result='';for(const char of name){if(Buffer.byteLength(result+char)>180)break;result+=char;}
 return result||'attachment';
}
async function readMessageContent(account,input,{withMailbox}){
 const ref=messageReference(input);
 return withMailbox(account,ref.path,async client=>{
  if(String(client.mailbox.uidValidity)!==ref.validity)throw fail('STALE_MESSAGE','Mailbox identity changed. Refresh this folder.');
  const meta=await client.fetchOne(ref.uid,{size:true},{uid:true});
  if(!meta)throw fail('MESSAGE_GONE','This message moved or was deleted. Refresh this folder.');
  if(!Number.isSafeInteger(meta.size)||meta.size<0)throw fail('MESSAGE_SIZE_UNKNOWN','The server did not provide a valid message size.');
  if(meta.size>MAX_SOURCE)throw fail('MESSAGE_TOO_LARGE','This message exceeds the 25 MB message download limit. Open it with your provider.');
  const mail=await client.fetchOne(ref.uid,{source:{start:0,maxLength:MAX_SOURCE+1}},{uid:true});
  if(!Buffer.isBuffer(mail?.source))throw fail('MESSAGE_GONE','This message moved or was deleted. Refresh this folder.');
  if(mail.source.length>MAX_SOURCE)throw fail('MESSAGE_TOO_LARGE','This message exceeds the 25 MB message download limit.');
  if(mail.source.length!==meta.size)throw fail('MESSAGE_CHANGED','The message download was incomplete. Refresh this folder and try again.');
  const parsed=await simpleParser(mail.source,{skipHtmlToText:false,skipTextToHtml:true,skipImageLinks:true,maxHtmlLengthToParse:1024*1024});
  if(parsed.attachments.length>100)throw fail('TOO_MANY_ATTACHMENTS','This message exceeds the 100 attachment limit. Open it with your provider.');
  return {text:String(parsed.text||'No plain text content available.').slice(0,200000),attachments:parsed.attachments.map((a,index)=>({index,filename:safeFilename(a.filename),contentType:String(a.contentType||'application/octet-stream').slice(0,200),size:a.content.length,digest:createHash('sha256').update(a.content).digest('hex'),content:a.content}))};
 });
}
function publicContent(content){return {text:content.text,attachments:content.attachments.map(({content,...a})=>({...a,canSave:a.size<=MAX_ATTACHMENT}))};}
module.exports={readMessageContent,publicContent,messageReference,safeFilename,MAX_SOURCE,MAX_ATTACHMENT,fail};

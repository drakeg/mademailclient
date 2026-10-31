export function createAttachmentView({client,text,icon,notice,onChange}){
 const saving=new Set();
 return {render(message,parent){
  if(!message.attachments?.length)return;
  const section=text('section','',parent,'message-attachments');section.setAttribute('aria-label','Attachments');
  text('h3',`${message.attachments.length} attachment${message.attachments.length===1?'':'s'}`,section);
  for(const attachment of message.attachments){
   const row=text('div','',section,'attachment');icon('paperclip',row);
   const info=text('div','',row,'attachment-info');text('strong',attachment.filename,info);
   text('small',`${attachment.size<1024?attachment.size+' bytes':attachment.size<1048576?(attachment.size/1024).toFixed(1)+' KB':(attachment.size/1048576).toFixed(1)+' MB'} · ${attachment.contentType}`,info);
   const key=message.id+':'+attachment.index,button=text('button',saving.has(key)?'Saving…':'Save As…',row,'attachment-save');
   button.type='button';button.dataset.attachmentKey=key;button.setAttribute('aria-label',`Save ${attachment.filename}`);button.disabled=saving.has(key)||!attachment.canSave||!client?.save;
   if(!attachment.canSave)text('small','Exceeds the 20 MB save limit',info);
   button.onclick=async()=>{
    if(saving.has(key))return;saving.add(key);onChange();
    try{
     const result=await client.save({accountId:message.accountId,path:message.path,uid:message.uid,validity:message.validity,index:attachment.index,digest:attachment.digest});
     if(!result.ok)throw new Error(result.error||'The attachment could not be saved.');
     if(!result.data.canceled)notice(`Saved ${attachment.filename}.`);
    }catch(error){notice(error.message||'The attachment could not be saved.');}
    finally{const restoreFocus=document.activeElement===document.body;saving.delete(key);onChange();if(restoreFocus)[...parent.querySelectorAll('[data-attachment-key]')].find(n=>n.dataset.attachmentKey===key)?.focus();}
   };
  }
 }};
}

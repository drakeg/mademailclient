export const canSendAccount=account=>!!account?.smtp&&(!account.authType||account.authType!=='oauth2'||account.provider==='google');
export function replyDraft(action,message,own){
   const targets=message.email.toLowerCase()===own.email.toLowerCase()?(message.toAddresses||[]):message.replyTo?.length?message.replyTo:[message.email];
   const clean=items=>[...new Map(items.filter(v=>v&&v.toLowerCase()!==own.email.toLowerCase()).map(v=>[v.toLowerCase(),v])).values()];
   const record={accountId:own.id,subject:(action==='forward'?'Fwd: ':'Re: ')+message.subject.replace(action==='forward'?/^fwd:\s*/i:/^re:\s*/i,''),text:'\n\n'+(action==='forward'?'Forwarded message':'On '+message.time+', '+message.from+' wrote:')+'\n'+message.body.split('\n').map(line=>'> '+line).join('\n')};
   if(action!=='forward'){record.to=clean(targets);record.cc=action==='replyAll'?clean([...(message.toAddresses||[]),...(message.ccAddresses||[])]).filter(v=>!record.to.some(to=>to.toLowerCase()===v.toLowerCase())):[];record.inReplyTo=message.messageId;}
 return record;
}
export function createComposer({el,text,getAccounts,notice,outgoing=window.desktopMail?.outgoing}){
 const dialog=el('composer'),form=el('compose-form'),fields=form.elements;
 let id,replyId,dirty=false,locked=false,busy=false;
 async function call(name,input){const r=await outgoing[name](input);if(!r.ok)throw new Error(r.error);return r.data;}
 function payload(){return {id,accountId:fields.accountId.value,to:fields.to.value,cc:fields.cc.value,bcc:fields.bcc.value,subject:fields.subject.value,text:fields.text.value,inReplyTo:replyId};}
 function state(message){el('compose-status').textContent=message;el('compose-fields').disabled=busy||locked;el('compose-send').disabled=busy||locked;el('compose-save').disabled=busy||locked;el('compose-close').disabled=busy;}
 function fill(record={}){
  const select=fields.accountId;select.replaceChildren();for(const a of getAccounts().filter(canSendAccount)){const o=text('option',a.email,select);o.value=a.id;}
  fields.accountId.value=record.accountId||select.options[0]?.value||'';
  for(const key of ['to','cc','bcc'])fields[key].value=Array.isArray(record[key])?record[key].join(', '):record[key]||'';
  fields.subject.value=record.subject||'';fields.text.value=record.text||'';
  id=record.id;replyId=record.inReplyTo;dirty=false;locked=!!record.status&&record.status!=='draft';busy=false;
  state(locked?statusText(record):'Plain-text mail. Drafts are saved locally and encrypted. Sending attachments is not supported yet; forwarding includes text only.');
 }
 function open(action='compose',message){
  if(!outgoing||!getAccounts().some(canSendAccount)){notice('Add an account with outgoing SMTP settings first.');return;}
  if(dialog.open){dialog.focus();return;}
  let record={};
  if(message){
   const own=getAccounts().find(a=>a.id===message.accountId);
   if(!canSendAccount(own)){notice('This account does not support sending.');return;}
   record=replyDraft(action,message,own);
  }
  fill(record);dialog.showModal();fields.to.focus();
 }
 function statusText(record){
  if(record.status==='unknown'||record.status==='sending')return 'Submission outcome unknown. Do not resend automatically. Check provider Sent and confirm receipt before composing another copy.';
  return `SMTP server accepted the message${record.partial?' for only some recipients; others were rejected':''}. This does not confirm delivery. Sent copy: ${record.copy||'pending'}.`;
 }
 async function persist(){const r=await call('save',payload());id=r.id;dirty=false;return r;}
 form.addEventListener('input',()=>{dirty=true;});
 el('compose-save').onclick=async()=>{busy=true;state('Saving local draft…');try{await persist();state('Draft saved locally (encrypted).');}catch(e){state(e.message);}finally{busy=false;state(el('compose-status').textContent);}};
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||locked)return;busy=true;state('Saving before submission…');
  let submitted=false;
  try{await persist();state('Submitting once to the SMTP server…');submitted=true;const result=await call('send',id);locked=true;state(statusText(result));}
  catch(e){if(submitted)locked=true;state(submitted?'Could not confirm submission status. Open File → Local Drafts and Sending Status before attempting another send.':e.message);}
  finally{busy=false;state(el('compose-status').textContent);}
 };
 function close(){if(busy)return;if(dirty&&!confirm('Discard changes since the last local draft save?'))return;dialog.close();}
 el('compose-close').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 async function showRecords(){
  const pane=el('outgoing-records');pane.replaceChildren();
  try{const rows=await call('list');if(!rows.length)text('p','No local drafts or submission records.',pane);
   for(const record of rows){const row=text('section','',pane,'outgoing-record');text('strong',record.subject||'(No subject)',row);text('p',(getAccounts().find(a=>a.id===record.accountId)?.email||'Removed account')+' → '+record.to.join(', '),row);text('p',record.status==='draft'?'Local draft':statusText(record),row);
    const edit=text('button',record.status==='draft'?'Open draft':'View submission',row);edit.onclick=()=>{if(dialog.open)return;el('outgoing').close();fill(record);dialog.showModal();};
    const remove=text('button','Remove local record',row);remove.onclick=async()=>{if(!confirm('Remove this local draft or status record? Sent mail is not recalled.'))return;try{await call('discard',record.id);await showRecords();}catch(e){notice(e.message);}};
   }
   if(!el('outgoing').open)el('outgoing').showModal();
  }catch(e){notice(e.message);}
 }
 el('outgoing-close').onclick=()=>el('outgoing').close();
 return {open,showRecords};
}

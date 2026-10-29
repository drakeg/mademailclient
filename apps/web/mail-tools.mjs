export function createMailTools({el,text,getAccounts,getFolders,refresh,notice,client=window.desktopMail?.mail}){
 const call=async(name,input)=>{if(!client)throw new Error('Open the desktop app to change connected mail.');const r=await client[name](input);if(!r.ok)throw new Error(r.error);return r.data;};
 function accounts(select,preferred){select.replaceChildren();for(const a of getAccounts()){const o=text('option',a.email,select);o.value=a.id;}if(preferred)select.value=preferred;}
 function destinations(select,accountId,includeAutomatic=false){select.replaceChildren();if(includeAutomatic){const o=text('option','Use server’s special folder',select);o.value='';}for(const f of getFolders(accountId)){const o=text('option',f.name+' — '+f.path,select);o.value=f.path;}}
 async function folderSettings(){
  if(!getAccounts().length){notice('Add an account first.');return;}
  accounts(el('folder-account'));const saved=await call('getSettings');
  function fill(){const id=el('folder-account').value,config=saved.find(s=>s.id===id)?.folders||{};for(const kind of ['trash','junk','archive']){destinations(el('folder-'+kind),id,true);el('folder-'+kind).value=config[kind]||'';}}
  el('folder-account').onchange=fill;fill();el('folder-settings-status').textContent='';el('folder-settings').showModal();
 }
 el('folder-settings-close').onclick=()=>el('folder-settings').close();
 el('folder-settings-form').onsubmit=async e=>{e.preventDefault();el('folder-settings-save').disabled=true;try{await call('saveSettings',{accountId:el('folder-account').value,folders:Object.fromEntries(['trash','junk','archive'].map(k=>[k,el('folder-'+k).value]))});el('folder-settings-status').textContent='Folder mappings saved. They will be used after restart too.';await refresh();}catch(error){el('folder-settings-status').textContent=error.message;}finally{el('folder-settings-save').disabled=false;}};
 let moving;
 function move(message){if(!message)return;moving=message;destinations(el('move-destination'),message.accountId);el('move-status').textContent='';el('move-dialog').showModal();}
 el('move-close').onclick=()=>el('move-dialog').close();
 async function apply(message,action,destination){
  const r=await call('apply',{requestId:crypto.randomUUID(),accountId:message.accountId,path:message.path,validity:message.validity,uid:message.uid,action,...(destination?{destination}:{})});
  if(r.status!=='done')throw new Error(r.error||'Action outcome unknown. Refresh and review Action History before trying again.');return r;
 }
 el('move-form').onsubmit=async e=>{e.preventDefault();el('move-submit').disabled=true;try{await apply(moving,'move',el('move-destination').value);el('move-dialog').close();await refresh();notice('Message moved.');}catch(error){el('move-status').textContent=error.message;}finally{el('move-submit').disabled=false;}};
 async function history(){const rows=await call('history'),pane=el('action-history-rows');pane.replaceChildren();if(!rows.length)text('p','No mailbox actions recorded yet.',pane);for(const r of rows){const row=text('section','',pane,'outgoing-record');text('strong',`${r.action} · ${r.status}`,row);text('p',`${getAccounts().find(a=>a.id===r.accountId)?.email||'Removed account'} · ${r.path} · UID ${r.uid} · ${r.at}`,row);if(r.error)text('p',r.error,row);if(r.destination)text('p','Destination: '+r.destination,row);}el('action-history').showModal();}
 el('action-history-close').onclick=()=>el('action-history').close();return {apply,move,folderSettings,history,settings:()=>call('getSettings')};
}

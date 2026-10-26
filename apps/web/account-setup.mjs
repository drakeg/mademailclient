// Account settings live in the main process. This controller never stores secrets locally.
export function createAccountSetup({el,text,desktop,getAccounts,refreshAccounts,closeWindowMenus}) {
 const form=el('account-form'),fields=form.elements,dialog=el('accounts');
 let editing=null,revision=0,saving=false,lastLookup='',dirty=new Set();
 const status=message=>{el('account-status').textContent=message;};
 const clearPasswords=()=>{fields.password.value='';fields.smtpPassword.value='';};
 function smtpAuth(){
  el('smtp-auth-fields').hidden=fields.sameIncoming.checked;
  el('smtp-auth-fields').disabled=fields.sameIncoming.checked;
  fields.smtpPassword.required=!editing&&!fields.sameIncoming.checked;
 }
 function reset(account=null){
  revision++;editing=account;lastLookup='';dirty.clear();form.reset();clearPasswords();
  el('account-form-title').textContent=account?'Edit account':'Add an account';
  el('account-save').textContent=account?'Test and save changes':'Test and add account';
  fields.password.required=!account;
  fields.password.placeholder=account?'Leave blank to keep saved password':'';
  fields.smtpPassword.placeholder=account?.smtp?'Leave blank to keep saved SMTP password':'';
  if(account){
   for(const key of ['email','host','username'])fields[key].value=account[key];
   fields.port.value=String(account.port??993);fields.security.value=account.security??'tls';
   fields.sameIncoming.checked=account.smtp?.useIncomingAuth??true;
   if(account.smtp)for(const [key,name]of Object.entries({host:'smtpHost',port:'smtpPort',security:'smtpSecurity',username:'smtpUsername'}))fields[name].value=account.smtp[key];
  }
  el('discovery-status').textContent='Server discovery uses the email domain only. No password is sent until you test and save.';
  status(account?'Leave a password blank to keep it when its server and username are unchanged.':'');smtpAuth();
 }
 function accountList(){
  const list=el('account-list');list.replaceChildren();
  for(const account of getAccounts()){
   const row=text('div','',list,'saved-account');text('strong',account.email,row);text('small',account.smtp?'Incoming and outgoing configured':'Incoming only · add outgoing settings with Edit',row);
   const actions=text('div','',row,'saved-account-actions');
   const edit=text('button','Edit settings',actions);edit.onclick=()=>{if(!saving){reset(account);fields.email.focus();}};
   const remove=text('button','Remove account',actions);remove.onclick=async()=>{
    if(saving||!confirm('Remove '+account.email+' from Made Mail? Mail on the server will remain.'))return;
    saving=true;edit.disabled=remove.disabled=true;
    try{const r=await desktop.accounts.remove(account.id);if(!r.ok)throw new Error(r.error);await refreshAccounts();if(editing?.id===account.id)reset();accountList();}catch(error){status(error.message||'Could not remove account.');}finally{saving=false;edit.disabled=remove.disabled=false;}
   };
  }
  if(!desktop)text('p','Account connections are available in the installed desktop app.',list);
 }
 function open(mode='manage'){
  closeWindowMenus();el('accounts-title').textContent=mode==='add'?'Add Account':'Accounts';
  el('accounts-description').textContent='Set up incoming and outgoing mail. Removing an account here leaves mail on its server.';
  if(!saving){reset();accountList();}
  form.hidden=!desktop;if(!dialog.open)dialog.showModal();
  if(mode==='add'&&desktop&&!saving)fields.email.focus();
 }
 async function discover(force=false){
  if(!desktop||saving||!fields.email.checkValidity()||!fields.email.value.trim())return;
  const email=fields.email.value.trim();
  if(!force&&(editing||lastLookup===email))return;
  const request=++revision;lastLookup=email;
  const output=el('discovery-status');output.textContent='Looking for incoming and outgoing server settings…';
  el('discover-account').setAttribute('aria-busy','true');
  try{
   const response=await desktop.accounts.discover(email);
   if(request!==revision||email!==fields.email.value.trim()||!dialog.open)return;
   if(!response.ok)throw new Error(response.error);
   const r=response.data;
   const apply=(name,value)=>{if(!dirty.has(name))fields[name].value=String(value);};
   if(r.imap)for(const [key,name]of Object.entries({host:'host',port:'port',security:'security',username:'username'}))apply(name,r.imap[key]);
   if(r.smtp)for(const [key,name]of Object.entries({host:'smtpHost',port:'smtpPort',security:'smtpSecurity',username:'smtpUsername'}))apply(name,r.smtp[key]);
   if(!fields.username.value)apply('username',email);
   if(!fields.smtpUsername.value)apply('smtpUsername',email);
   output.textContent=(r.imap||r.smtp?`${r.source}${r.provider?' · '+r.provider:''}. ${!r.imap||!r.smtp?'Some settings are missing; fill them manually. ':''}`:'')+r.note+' Manual edits are preserved.';
  }catch(error){if(request===revision){lastLookup='';output.textContent=(error.message||'Discovery unavailable.')+' Enter server settings manually.';}}
  finally{if(request===revision)el('discover-account').setAttribute('aria-busy','false');}
 }
 form.addEventListener('input',event=>{
  revision++;el('discover-account').setAttribute('aria-busy','false');
  if(event.target.name&&event.target.name!=='email'){dirty.add(event.target.name);if(el('discovery-status').textContent.startsWith('Looking for'))el('discovery-status').textContent='Settings edited. Use Find settings to try discovery again.';}
  if(event.target.name==='email'){lastLookup='';el('discovery-status').textContent='Leave this field to find server settings, or use Find settings.';}
 });
 form.addEventListener('change',event=>{if(event.target.name!=='email'){revision++;dirty.add(event.target.name);el('discover-account').setAttribute('aria-busy','false');}});
 fields.email.addEventListener('change',()=>{queueMicrotask(()=>discover());});
 fields.sameIncoming.onchange=smtpAuth;
 el('discover-account').onclick=()=>discover(true);
 for(const [name,port]of [['security','port'],['smtpSecurity','smtpPort']])fields[name].addEventListener('change',()=>{fields[port].value=fields[name].value==='tls'?(name==='security'?'993':'465'):(name==='security'?'143':'587');dirty.add(port);});
 el('account-new').onclick=()=>{if(!saving){reset();fields.email.focus();}};
 form.onsubmit=async event=>{
  event.preventDefault();if(saving||!form.reportValidity())return;
  revision++;saving=true;
  const data=new FormData(form),input={email:data.get('email'),host:data.get('host'),port:Number(data.get('port')),security:data.get('security'),username:data.get('username'),password:data.get('password'),
   smtp:{host:data.get('smtpHost'),port:Number(data.get('smtpPort')),security:data.get('smtpSecurity'),useIncomingAuth:fields.sameIncoming.checked,username:data.get('smtpUsername')||'',password:data.get('smtpPassword')||''}};
  if(editing)input.id=editing.id;
  const operation=editing?'update':'add';el('account-fields').disabled=true;el('account-save').disabled=true;
  status('Testing incoming and outgoing connections. No email will be sent…');
  try{
   const response=await desktop.accounts[operation](input);
   if(!response.ok)throw new Error(response.error);
   await refreshAccounts();
   if(dialog.open){reset(getAccounts().find(a=>a.id===response.data.id)||null);accountList();status('Incoming and outgoing logins verified. Settings saved. Sending mail is not available yet.');}
  }catch(error){if(dialog.open)status(error.message||'Could not save settings. Existing settings were preserved.');}
  finally{clearPasswords();input.password='';input.smtp.password='';el('account-fields').disabled=false;el('account-save').disabled=false;saving=false;}
 };
 dialog.addEventListener('close',()=>{revision++;clearPasswords();el('discover-account').setAttribute('aria-busy','false');});
 return {open};
}

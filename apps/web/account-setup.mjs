// Account settings live in the main process. This controller never stores secrets locally.
export function createAccountSetup({el,text,desktop,getAccounts,refreshAccounts,closeWindowMenus}) {
 const form=el('account-form'),fields=form.elements,dialog=el('accounts');
 let editing=null,revision=0,saving=false,lastLookup='',dirty=new Set();
 let simpleProvider=null,selectedProvider=null,providerStates=[],oauthPending=false;
 const providerNames={google:'Gmail',yahoo:'Yahoo Mail',icloud:'iCloud Mail'};
 const providerDomains={google:'gmail.com',yahoo:'yahoo.com',icloud:'icloud.com'};
 const status=message=>{el('account-status').textContent=message;};
 const clearPasswords=()=>{fields.password.value='';fields.smtpPassword.value='';};
 function smtpAuth(){
  el('smtp-auth-fields').hidden=fields.sameIncoming.checked;
  el('smtp-auth-fields').disabled=fields.sameIncoming.checked;
  fields.smtpPassword.required=!editing&&!fields.sameIncoming.checked;
 }
 function reset(account=null){
  revision++;editing=account;lastLookup='';dirty.clear();form.reset();clearPasswords();simpleProvider=null;
  el('account-server-settings').open=true;el('simple-provider-help').textContent='';
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
   const row=text('div','',list,'saved-account');text('strong',account.email,row);text('small',account.authType==='oauth2'?`Browser-authorized ${providerNames[account.provider]||account.provider} · account settings saved`:account.smtp?'Incoming and outgoing configured':'Incoming only · add outgoing settings with Edit',row);
   const actions=text('div','',row,'saved-account-actions');
   const edit=text('button',account.authType==='oauth2'?'Reconnect':'Edit settings',actions);edit.onclick=()=>{if(!saving){reset(account);el('provider-picker').hidden=true;if(account.authType==='oauth2'){selectProvider(account.provider,account);}else{el('provider-methods').hidden=true;form.hidden=false;fields.email.focus();}}};
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
  el('accounts-description').textContent='Server settings and credentials are saved securely for the next launch. Removing an account here leaves mail on its server.';
  if(!saving){reset();accountList();selectedProvider=null;el('provider-picker').hidden=!desktop;el('provider-methods').hidden=true;form.hidden=true;loadProviders();}
  if(!dialog.open)dialog.showModal();
  if(mode==='add'&&desktop&&!saving)el('provider-picker').querySelector('button').focus();
 }
 async function discover(force=false){
  if(!desktop||saving||simpleProvider||!fields.email.checkValidity()||!fields.email.value.trim())return;
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
  if(event.target.name==='email'){if(simpleProvider){if(!dirty.has('username'))fields.username.value=fields.email.value.trim();if(!dirty.has('smtpUsername'))fields.smtpUsername.value=fields.email.value.trim();}lastLookup='';el('discovery-status').textContent='Leave this field to find server settings, or use Find settings.';}
 });
 form.addEventListener('change',event=>{if(event.target.name!=='email'){revision++;dirty.add(event.target.name);el('discover-account').setAttribute('aria-busy','false');}});
 fields.email.addEventListener('change',()=>{queueMicrotask(()=>discover());});
 fields.sameIncoming.onchange=smtpAuth;
 el('discover-account').onclick=()=>discover(true);
 for(const [name,port]of [['security','port'],['smtpSecurity','smtpPort']])fields[name].addEventListener('change',()=>{fields[port].value=fields[name].value==='tls'?(name==='security'?'993':'465'):(name==='security'?'143':'587');dirty.add(port);});
 el('account-new').onclick=()=>{if(!saving){reset();el('provider-picker').hidden=false;el('provider-methods').hidden=true;form.hidden=true;}};
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
 dialog.addEventListener('close',()=>{if(oauthPending)desktop.accounts.cancelSignIn().catch(()=>{});revision++;clearPasswords();el('discover-account').setAttribute('aria-busy','false');});

 async function loadProviders(){
  if(!desktop)return;
  try{const response=await desktop.accounts.providers();providerStates=response.ok?response.data:[];}catch{providerStates=[];}
  if(selectedProvider&&!simpleProvider)updateProviderAvailability();
 }
 function updateProviderAvailability(){
  const state=providerStates.find(p=>p.id===selectedProvider);
  el('provider-browser-signin').disabled=oauthPending||!state?.available;el('provider-browser-signin').title=state?.reason||'Publisher app registration is required.';
  el('provider-availability').textContent=state?.reason||'Browser sign-in needs publisher app registration. App-password setup is available below.';
  el('provider-permissions').textContent=selectedProvider==='google'?'Google IMAP authorization requests full mail access. Connected Google mail supports reading, sending and mailbox actions.':'Yahoo authorization requests identity and read-only mail access.';
 }
 function selectProvider(id,account=null){
  if(saving)return;el('provider-browser-signin').hidden=false;selectedProvider=id;editing=account;clearPasswords();
  el('provider-picker').hidden=true;form.hidden=true;el('provider-methods').hidden=false;
  el('provider-method-title').textContent='Connect '+providerNames[id];
  el('provider-app-password').hidden=!!account?.oauth||account?.authType==='oauth2';updateProviderAvailability();
 }
 async function simpleSetup(id){
  if(saving)return;reset();simpleProvider=id;selectedProvider=id;
  el('provider-picker').hidden=true;el('provider-methods').hidden=false;form.hidden=false;
  el('provider-browser-signin').hidden=id==='icloud';el('provider-app-password').hidden=true;
  el('provider-permissions').textContent='';el('provider-method-title').textContent=providerNames[id]+' · app password';
  el('provider-availability').textContent='Enter your email address and a provider-generated app password. Server settings are filled for you.';
  el('simple-provider-help').textContent='Use an app password, not your normal account password. Your provider may require two-factor authentication or restrict app passwords.';
  el('account-server-settings').open=false;el('account-save').disabled=true;
  try{
   const response=await desktop.accounts.discover('setup@'+providerDomains[id]);
   if(simpleProvider!==id||!dialog.open)return;
   if(!response.ok)throw new Error(response.error);
   for(const [server,mapping]of [[response.data.imap,{host:'host',port:'port',security:'security'}],[response.data.smtp,{host:'smtpHost',port:'smtpPort',security:'smtpSecurity'}]])for(const [key,name]of Object.entries(mapping))if(!dirty.has(name))fields[name].value=String(server[key]);
   fields.username.value=fields.email.value.trim();fields.smtpUsername.value=fields.email.value.trim();
   el('discovery-status').textContent=response.data.note;
  }catch{if(simpleProvider===id){el('account-server-settings').open=true;status('Could not load provider settings. Enter server settings manually.');}}
  finally{if(simpleProvider===id)el('account-save').disabled=false;}
  if(simpleProvider===id)fields.email.focus();
 }
 for(const button of document.querySelectorAll('[data-account-provider]'))button.onclick=()=>{
  const id=button.dataset.accountProvider;el('provider-browser-signin').hidden=false;
  if(id==='icloud')simpleSetup(id);
  else if(id==='other'){reset();selectedProvider=null;el('provider-picker').hidden=true;el('provider-methods').hidden=false;el('provider-method-title').textContent='Other email · IMAP/SMTP';el('provider-availability').textContent='Enter your provider settings or use Find settings after entering your address.';el('provider-permissions').textContent='';el('provider-browser-signin').hidden=true;el('provider-app-password').hidden=true;form.hidden=false;fields.email.focus();}
  else selectProvider(id);
 };
 el('provider-app-password').onclick=()=>simpleSetup(selectedProvider);
 el('provider-back').onclick=()=>{if(!saving){reset();selectedProvider=null;el('provider-picker').hidden=false;el('provider-methods').hidden=true;form.hidden=true;el('account-save').disabled=false;}};
 el('provider-browser-signin').onclick=async()=>{
  if(saving||!selectedProvider)return;saving=true;oauthPending=true;clearPasswords();el('provider-cancel').hidden=false;el('provider-browser-signin').disabled=true;el('provider-app-password').disabled=true;el('provider-back').disabled=true;
  el('provider-availability').textContent='Continue in your default browser. Approve access there, then return here.';
  try{
   const response=await desktop.accounts.signIn({provider:selectedProvider,...(editing?{accountId:editing.id,emailHint:editing.email}: {})});
   if(!response.ok)throw new Error(response.error);await refreshAccounts();accountList();
   if(dialog.open)el('provider-availability').textContent='Connected '+response.data.email+'. Sending mail is not available yet.';
  }catch(error){if(dialog.open)el('provider-availability').textContent=error.message||'Sign-in did not complete. Try again.';}
  finally{saving=false;oauthPending=false;el('provider-cancel').hidden=true;el('provider-app-password').disabled=false;el('provider-back').disabled=false;el('provider-browser-signin').disabled=!providerStates.find(p=>p.id===selectedProvider)?.available;}
 };
 el('provider-cancel').onclick=()=>desktop.accounts.cancelSignIn().catch(()=>{});
 return {open};
}

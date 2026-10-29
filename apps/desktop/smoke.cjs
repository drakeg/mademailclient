// Packaged desktop acceptance uses only an isolated profile and fictional mail.
function attachSmokeTest(app,window,Menu) {
 const fail=error=>{console.error('DESKTOP_SMOKE_FAILED',error);app.exit(1);};
 const timeout=setTimeout(()=>fail('Timed out waiting for the packaged interface'),30000);
 window.webContents.once('did-fail-load',(_event,code,description)=>fail(`${code}: ${description}`));
 window.webContents.once('render-process-gone',(_event,details)=>fail(details.reason));
 const run=code=>window.webContents.executeJavaScript(`(async()=>{
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const wait=async(test)=>{for(let n=0;n<100;n++){if(test())return;await new Promise(r=>setTimeout(r,50));}throw new Error('Interface state timed out');};
  ${code}
 })()`);
 const item=id=>{const i=Menu.getApplicationMenu()?.getMenuItemById(id);if(!i)throw new Error('Native menu missing '+id);return i;};
 const waitMenu=async test=>{for(let n=0;n<100;n++){if(test())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Native message-menu state timed out');};
 window.webContents.once('did-finish-load',async()=>{
  try{
   // Exercise the packaged main-process rule planner/adapter without any real account or network.
   const {createMailActions}=require('./mail-actions.cjs'),{createMailRules}=require('./mail-rules.cjs');
   const memory=(rows=[])=>({list:async()=>structuredClone(rows),update:async change=>{rows=change(structuredClone(rows));}});
   let moved=0;
   const fixtureVault=memory([{id:'fixture-main'}]);
   const adapter=createMailActions({vault:fixtureVault,journal:memory(),settings:memory(),connect:async(_account,run)=>run({capabilities:new Set(['MOVE']),mailbox:{uidValidity:'1'},list:async()=>[{path:'Trash',specialUse:'\\Trash'}],getMailboxLock:async()=>({release(){}}),fetchOne:async()=>({uid:1}),messageMove:async()=>{moved++;return true;}})});
   const engine=createMailRules({vault:fixtureVault,store:memory(),cursors:memory(),actions:adapter,fetch:async()=>({validity:'1',messages:[{id:'fixture-main:1',accountId:'fixture-main',path:'INBOX',uid:1,validity:'1',subject:'Invoice',email:'sender@example.com'}]})});
   await engine.save({name:'Packaged rule',accountId:'fixture-main',enabled:true,stopProcessing:true,match:'all',conditions:[{field:'subject',operator:'contains',value:'invoice'}],exceptions:[],actions:[{type:'trash'}]});
   const planned=await engine.preview('fixture-main');if(planned.matches.length!==1)throw new Error('Packaged rule planner unavailable');
   const executed=await engine.run(planned.token);if(executed.done!==1||moved!==1)throw new Error('Packaged rule adapter unavailable');
   const prefs=window.webContents.getLastWebPreferences();
   if(!prefs.sandbox||!prefs.contextIsolation||prefs.nodeIntegration)throw new Error('Unsafe renderer preferences');
   if(!window.isClosable()||!window.isMinimizable()||!window.isMaximizable()||window.isFullScreen())throw new Error('Native window controls unavailable');
   await run(`await wait(()=>document.querySelector('#refresh').getAttribute('aria-busy')==='false');assert(!document.querySelector('.message'),'No default messages');assert(!document.querySelector('.ribbon'),'No ribbon');assert(!document.querySelector('.sidebar button:not([data-view])'),'Folder-only sidebar');assert(getComputedStyle(document.querySelector('.window-menu')).display==='none','OS menu replaces HTML menu');`);
   if(item('message:junk').enabled)throw new Error('Message menu enabled without selection');
   item('accounts:add').click();
   await run(`
    await wait(()=>document.querySelector('#accounts').open);
    assert(document.querySelector('[data-account-provider="google"]')&&document.querySelector('[data-account-provider="yahoo"]'),'Provider chooser');
    document.querySelector('[data-account-provider="google"]').click();
    const registration=await window.desktopMail.accounts.providers();
    if(!registration.data.find(p=>p.id==='google').available)assert(document.querySelector('#provider-browser-signin').disabled,'Unregistered browser sign-in is unavailable');
    document.querySelector('#provider-app-password').click();
    const f=document.querySelector('#account-form').elements;
    await wait(()=>f.host.value==='imap.gmail.com'&&!document.querySelector('#account-save').disabled);
    assert(!document.querySelector('#account-server-settings').open,'Simple setup hides advanced fields');
    f.email.value='sample@gmail.com';f.email.dispatchEvent(new Event('input',{bubbles:true}));
    assert(f.username.value==='sample@gmail.com'&&f.smtpUsername.value==='sample@gmail.com','Simple setup fills both usernames');
    document.querySelector('#provider-back').click();document.querySelector('[data-account-provider="other"]').click();
    assert(f.smtpHost&&f.smtpPort&&f.smtpSecurity,'SMTP controls');
    f.email.value='sample@icloud.com';f.email.dispatchEvent(new Event('input',{bubbles:true}));f.email.dispatchEvent(new Event('change',{bubbles:true}));
    await wait(()=>document.querySelector('#discovery-status').textContent.includes('Built-in provider settings'));
    assert(f.host.value==='imap.mail.me.com'&&f.smtpHost.value==='smtp.mail.me.com','Automatic settings');
    f.host.value='manual.example.com';f.host.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#discover-account').click();
    await wait(()=>document.querySelector('#discovery-status').textContent.includes('Built-in provider settings'));assert(f.host.value==='manual.example.com','Manual override');
    f.sameIncoming.checked=false;f.sameIncoming.dispatchEvent(new Event('change',{bubbles:true}));assert(!document.querySelector('#smtp-auth-fields').disabled,'Separate SMTP credentials');
    f.password.value='fictional-secret';f.smtpPassword.value='fictional-outgoing';
    const closed=new Promise(resolve=>document.querySelector('#accounts').addEventListener('close',resolve,{once:true}));document.querySelector('#accounts-close').click();await closed;
    assert(f.password.value===''&&f.smtpPassword.value==='','Passwords cleared');
   `);
   item('accounts:add').click();
   await run(`await wait(()=>document.querySelector('#accounts').open);document.querySelector('#demo-mode').click();await wait(()=>document.querySelectorAll('.message').length===7);assert(!document.querySelector('.sidebar button:not([data-view])'),'Demo sidebar is folder-only');assert(document.querySelector('.message-toolbar [data-action="replyAll"]').disabled,'Reply All honestly unavailable');`);
   item('view:columns').click();
   await run(`await wait(()=>document.body.dataset.mailLayout==='columns');assert(getComputedStyle(document.querySelector('.reading-pane')).display==='none','Column layout hides reader');`);
   item('view:preview').click();
   await run(`await wait(()=>document.body.dataset.mailLayout==='preview');assert(getComputedStyle(document.querySelector('.reading-pane')).display!=='none','Reading pane restored');`);
   await waitMenu(()=>item('message:junk').enabled);
   item('message:junk').click();
   await run(`await wait(()=>document.querySelectorAll('.message').length===6);document.querySelector('[data-view="work:junk"]').click();assert(document.querySelector('.message .subject').textContent.includes('Brand direction'),'Message moved to its account Junk');assert(document.querySelector('.message-toolbar [data-action="junk"]').hidden,'Junk hidden in Junk');assert(!document.querySelector('.message-toolbar [data-action="notJunk"]').disabled,'Not Junk available');`);
   await waitMenu(()=>item('message:notJunk').visible&&item('message:notJunk').enabled);
   item('message:notJunk').click();
   await run(`await wait(()=>!document.querySelector('.message'));document.querySelector('[data-view="work"]').click();assert([...document.querySelectorAll('.subject')].some(n=>n.textContent.includes('Brand direction')),'Not Junk returns to same account Inbox');`);
   item('mailbox:rules').click();
   await run(`await wait(()=>document.querySelector('#rules').open);const form=document.querySelector('#rule-form');form.elements.term.value='invoice';form.elements.value.value='Finance';form.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));assert(document.querySelector('#preview').textContent.includes('1 matching inbox message'),'Native Rules command');document.querySelector('#rules').close();document.querySelector('[data-view="personal"]').click();assert(document.querySelectorAll('.message').length===3,'Individual inbox');const search=document.querySelector('#search');search.value='garden';search.dispatchEvent(new Event('input'));assert(document.querySelectorAll('.message').length===1,'Search');`);
   await run(`
    const {createComposer}=await import('/apps/web/composer.mjs');
    let saved,submissions=0;
    const compose=createComposer({el:id=>document.getElementById(id),text:(tag,value,parent)=>{const n=document.createElement(tag);n.textContent=value;parent.append(n);return n;},getAccounts:()=>[{id:'fixture',email:'sender@example.com',smtp:{host:'smtp.example.com'}}],notice:message=>{throw new Error(message);},outgoing:{save:async value=>{saved=value;return {ok:true,data:{id:'fixture'}};},send:async()=>{submissions++;return {ok:true,data:{status:'accepted',copy:'saved'}};}}});
    compose.open();assert(document.querySelector('#composer').open,'Composer opens');
    const cf=document.querySelector('#compose-form');cf.elements.to.value='friend@example.com';cf.elements.subject.value='Synthetic smoke';cf.elements.text.value='Fictional text only';
    document.querySelector('#compose-save').click();await wait(()=>document.querySelector('#compose-status').textContent.includes('Draft saved'));assert(saved.accountId==='fixture'&&saved.text==='Fictional text only','Draft preserves selected account and text');
    cf.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));await wait(()=>document.querySelector('#compose-status').textContent.includes('SMTP server accepted'));
    assert(submissions===1&&document.querySelector('#compose-send').disabled,'Accepted submission is locked');document.querySelector('#compose-close').click();
   `);
   await run(`
    const {createRuleEditor}=await import('/apps/web/rule-editor.mjs');let savedRules=[],applied=0;
    const helper=(tag,value,parent)=>{const n=document.createElement(tag);n.textContent=value;parent.append(n);return n;};
    const form=document.querySelector('#rule-form'),option=document.createElement('option');option.value='fixture';option.textContent='owner@example.com';form.elements.account.append(option);
    const editor=createRuleEditor({el:id=>document.getElementById(id),text:helper,getAccounts:()=>[{id:'fixture',email:'owner@example.com'}],getFolders:()=>[{name:'Finance',path:'Finance'}],getMessages:()=>[],isDemo:()=>false,refresh:async()=>{},notice:message=>{if(message.includes('failed'))throw new Error(message);},client:{list:async()=>({ok:true,data:savedRules}),save:async rule=>{savedRules=[{...rule,id:'saved-fixture',revision:'one'}];return {ok:true,data:{id:'saved-fixture'}};},preview:async()=>({ok:true,data:{token:'fixture-token',total:1,matches:[{subject:'Invoice'}]}}),run:async()=>{applied++;return {ok:true,data:{done:1,failed:0}};}}});
    await editor.open();form.elements.account.value='fixture';form.elements.ruleName.value='Saved invoice rule';form.elements.term.value='invoice';form.elements.action.value='move';form.elements.value.value='Finance';document.querySelector('#rule-save').click();
    await wait(()=>document.querySelector('#saved-rules').textContent.includes('Saved invoice rule'));assert(savedRules[0].actions[0].value==='Finance','Rule persists selected server folder');
    form.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));await wait(()=>!document.querySelector('#rules-apply').hidden);document.querySelector('#rules-apply').click();await wait(()=>document.querySelector('#preview').textContent.includes('1 action(s) applied'));assert(applied===1,'Previewed rule explicitly applied');document.querySelector('#rules').close();
    const {createMailTools}=await import('/apps/web/mail-tools.mjs');let folderSettings;
    const tools=createMailTools({el:id=>document.getElementById(id),text:helper,getAccounts:()=>[{id:'fixture',email:'owner@example.com'}],getFolders:()=>[{name:'Deleted Items',path:'Trash'}],refresh:async()=>{},notice:()=>{},client:{getSettings:async()=>({ok:true,data:[]}),saveSettings:async input=>{folderSettings=input;return {ok:true,data:input};}}});
    await tools.folderSettings();document.querySelector('#folder-trash').value='Trash';document.querySelector('#folder-settings-form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));await wait(()=>document.querySelector('#folder-settings-status').textContent.includes('saved'));assert(folderSettings.folders.trash==='Trash','Folder mapping persisted');document.querySelector('#folder-settings').close();
   `);
   console.log('DESKTOP_SMOKE_OK',JSON.stringify({platform:process.platform,arch:process.arch,checks:42}));
   clearTimeout(timeout);app.exit(0);
  }catch(error){fail(error.message);}
 });
}
module.exports={attachSmokeTest};

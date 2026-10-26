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
   console.log('DESKTOP_SMOKE_OK',JSON.stringify({platform:process.platform,arch:process.arch,checks:28}));
   clearTimeout(timeout);app.exit(0);
  }catch(error){fail(error.message);}
 });
}
module.exports={attachSmokeTest};

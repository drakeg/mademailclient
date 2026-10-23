document.documentElement.dataset.shell = window.desktopMail?.isDesktop ? 'desktop' : 'browser';
import { planRules, validateRule } from '/packages/core/rules.mjs';
import { emptyMailbox } from '/packages/core/mailboxes.mjs';
let messages = [
{id:'1',accountId:'work',from:'Morgan Chen',email:'morgan@studio.example',to:'alex@northstar.example',subject:'Brand direction — ready for your thoughts',body:'Hi there,\n\nI’ve pulled together the updated brand direction following our conversation on Monday. The new approach gives us a little more room to work with, while keeping the clarity we liked in the original.\n\nA few things to look at:\n\n• A simpler visual system across desktop and mobile\n• Warmer photography and a more considered color palette\n• A clearer hierarchy for the things that matter most\n\nWould love to hear what you think before we share it with the wider team on Friday. No rush today — tomorrow morning works well.\n\nThanks,\nMorgan\nDesign team',unread:true,time:'10:42 AM',date:'Today',folder:'inbox'},
{id:'3',accountId:'work',from:'Studio billing',email:'billing@studio.example',to:'alex@northstar.example',subject:'Your October invoice',body:'Hello,\n\nYour October invoice is ready for review. You’ll find a summary attached.\n\nThank you for being part of the studio. If you have any questions, just reply to this email.\n\nBest,\nThe Studio team',hasAttachment:true,attachment:'October-invoice.pdf',unread:true,time:'9:18 AM',date:'Today',folder:'inbox'},
{id:'4',accountId:'personal',from:'Alex Rivera',email:'alex@friends.example',to:'alex@icloud.example',subject:'Dinner next week?',body:'Hey!\n\nLet’s find an evening for dinner next week. Tuesday or Thursday? There’s a new place on the corner I’ve been meaning to try.\n\nHope your week is going well.\nAlex',unread:true,time:'8:54 AM',date:'Today',folder:'inbox'},
{id:'5',accountId:'work',from:'Priya Shah',email:'priya@studio.example',to:'alex@northstar.example',subject:'A few notes from our planning session',body:'Hi,\n\nThanks for a productive planning session. I’ve captured our next steps:\n\n1. Review the desktop prototype\n2. Confirm the account connection flow\n3. Share feedback with the team\n\nLet’s reconnect next week.\nPriya',flagged:true,time:'8:30 AM',date:'Today',folder:'inbox'},
{id:'2',accountId:'personal',from:'The neighborhood garden',email:'hello@garden.example',to:'alex@icloud.example',subject:'Saturday in the garden',body:'Hello neighbors,\n\nJoin us Saturday morning to plant the autumn beds. Bring a warm layer and a friend. Coffee will be ready at 9.\n\nSee you there,\nThe garden team',time:'Yesterday',date:'Yesterday',folder:'inbox'},
{id:'6',accountId:'work',from:'Daniel Park',email:'daniel@studio.example',to:'alex@northstar.example',subject:'Re: Project timeline',body:'The revised timeline looks good to me. Thanks for making room for another round of feedback.\n\nDaniel',time:'Yesterday',date:'Yesterday',folder:'inbox'},
{id:'7',accountId:'personal',from:'Weekend reads',email:'editor@reading.example',to:'alex@icloud.example',subject:'Something worth slowing down for',body:'This week’s reading list is about making space: for good ideas, long walks, and conversations that go somewhere.\n\nEnjoy your weekend.',time:'Yesterday',date:'Yesterday',folder:'inbox'},
{id:'8',accountId:'work',from:'You',email:'alex@northstar.example',to:'morgan@studio.example',subject:'Re: Kickoff notes',body:'Thanks Morgan. Looking forward to reviewing the next iteration.',time:'Yesterday',date:'Yesterday',folder:'sent'},
{id:'9',accountId:'personal',from:'You',email:'alex@icloud.example',to:'alex@friends.example',subject:'Photos from the weekend',body:'Such a good weekend. Let’s do it again soon!',time:'Monday',date:'Earlier',folder:'sent'},
{id:'10',accountId:'work',from:'Project team',email:'team@studio.example',to:'alex@northstar.example',subject:'Project resources',body:'Here are the reference notes for the upcoming project.',time:'Monday',date:'Earlier',folder:'projects'}];
messages.push(
 {id:'junk1',accountId:'personal',from:'Sample promotions',email:'offers@example.invalid',to:'alex@icloud.example',subject:'A sample junk message',body:'Fictional mail for testing Empty Junk.',time:'Yesterday',date:'Yesterday',folder:'junk'},
 {id:'trash1',accountId:'work',from:'Sample notification',email:'notice@example.invalid',to:'alex@northstar.example',subject:'A sample deleted message',body:'Fictional mail for testing Empty Deleted Items.',time:'Yesterday',date:'Yesterday',folder:'trash'}
);
const demoMessages=structuredClone(messages);
messages=[];
let demo=false, accounts=[], loading=false;
let view='inbox', unreadOnly=false, selectedId='1', noticeTimer;
const el=id=>document.getElementById(id);
const text=(tag,value,parent,className)=>{const n=document.createElement(tag);n.textContent=value;if(className)n.className=className;parent.append(n);return n;};
const icon=(name,parent)=>{const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('class','icon');n.setAttribute('aria-hidden','true');const use=document.createElementNS(n.namespaceURI,'use');use.setAttribute('href',`#i-${name}`);n.append(use);parent.append(n);return n;};
const names={inbox:'All inboxes',work:'alex@northstar.example',personal:'alex@icloud.example',sent:'Sent',projects:'Projects',unread:'Unread',flagged:'Flagged',archive:'Archive',junk:'Junk',trash:'Deleted items','work:sent':'Work · Sent','personal:sent':'Personal · Sent','work:projects':'Work · Projects'};
const accountName=id=>accounts.find(a=>a.id===id)?.email||(id==='work'?'alex@northstar.example':'alex@icloud.example');
const folderNames={inbox:'Inbox',drafts:'Drafts',sent:'Sent Items',trash:'Deleted Items',junk:'Junk Email',archive:'Archive',projects:'Projects'};
for(const account of ['work','personal'])for(const folder of Object.keys(folderNames))names[`${account}:${folder}`]=`${accountName(account)} · ${folderNames[folder]}`;
function mailboxScope(target=view){if(target.includes(':')){const [accountId,folder]=target.split(':');return {folder,accountId};}return ['work','personal'].includes(target)?{folder:'inbox',accountId:target}:{folder:target};}

function inView(m,target=view){
 if(target==='work'||target==='personal')return m.accountId===target&&m.folder==='inbox';
 if(target.includes(':')){const [account,folder]=target.split(':');return m.accountId===account&&m.folder===folder;}
 if(target==='unread')return m.unread&&m.folder==='inbox';
 if(target==='flagged')return m.flagged&&!['trash','junk'].includes(m.folder);
 return m.folder===target;
}
function visibleMessages(){const term=el('search').value.toLowerCase();return messages.filter(m=>inView(m)&&(!unreadOnly||m.unread)&&[m.from,m.subject,m.body].some(v=>v.toLowerCase().includes(term)));}
function notice(value){el('notice').textContent=value;el('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{el('notice').hidden=true;},4500);}
function renderReader(visible){
 const m=visible.find(m=>m.id===selectedId);el('reader').replaceChildren();
 document.querySelectorAll('[data-action]').forEach(b=>b.disabled=!m||!demo);
 el('reader-position').textContent=m?`${visible.indexOf(m)+1} of ${visible.length}`:'';
 if(!m){const empty=text('div','',el('reader'),'empty-state');icon('mail',empty);text('h2','No message selected',empty);text('p','Choose a message to read it here.',empty);return;}
 const label=text('div','',el('reader'),'reader-label');text('i','',label,`account-dot ${m.accountId}`);text('span',`${accountName(m.accountId)} / ${m.folder==='inbox'?'Inbox':m.folder}`,label);
 text('h2',m.subject,el('reader'));
 const sender=text('div','',el('reader'),'sender-card');text('div',m.from.split(' ').slice(0,2).map(w=>w[0]).join(''),sender,'avatar');const info=text('div','',sender,'sender-info');text('strong',m.from,info);text('p',`${m.email} → ${m.to}`,info);text('span',m.time,sender,'sender-date');
 text('div',m.body,el('reader'),'message-body');
 if(m.hasAttachment){const attachment=text('div','',el('reader'),'attachment');icon('paperclip',attachment);const info=text('div','',attachment);text('strong',m.attachment,info);text('small','Sample attachment · preview only',info);}
 const replies=text('div','',el('reader'),'reply-buttons');for(const [name,label] of [['reply','Reply'],['forward','Forward']]){const b=text('button','',replies);icon(name,b);text('span',label,b);b.disabled=true;b.title='Sending is coming with account connections';}
 document.querySelectorAll('[data-action="flag"]').forEach(button=>button.setAttribute('aria-pressed',String(!!m.flagged)));
 document.querySelectorAll('[data-action="unread"]').forEach(button=>button.setAttribute('aria-pressed',String(!!m.unread)));
}
function render(){
 const visible=visibleMessages();if(!visible.some(m=>m.id===selectedId))selectedId=visible[0]?.id;
 el('mailbox-title').textContent=names[view]||accountName(view.split(':')[0]);el('mailbox-summary').textContent=`${visible.length} message${visible.length===1?'':'s'} · ${visible.filter(m=>m.unread).length} unread`;
 el('messages').replaceChildren();let group;
 for(const m of visible){if(group!==m.date){group=m.date;text('div',group,el('messages'),'date-heading');}const b=text('button','',el('messages'),`message${m.unread?' unread':''}${selectedId===m.id?' selected':''}`);b.setAttribute('aria-pressed',String(selectedId===m.id));b.setAttribute('aria-label',`${m.from}: ${m.subject}, ${m.time}, ${accountName(m.accountId)}${m.unread?', unread':''}`);if(m.unread)text('span','',b,'unread-dot');text('span',m.from.split(' ').slice(0,2).map(w=>w[0].toUpperCase()).join(''),b,'message-avatar');const row=text('div','',b,'message-top');text('span',m.from,row,'sender');text('time',m.time,row);text('span',m.subject,b,'subject');text('span',m.body.replaceAll('\n',' '),b,'snippet');const meta=text('div','',b,'message-meta');text('i','',meta,`account-dot ${m.accountId}`);text('span',accountName(m.accountId),meta);if(m.hasAttachment)icon('paperclip',meta);if(m.flagged)icon('flag',meta);b.onclick=async()=>{selectedId=m.id;render();if(!demo&&m.uid&&!m.loaded){const r=await api('body',{accountId:m.accountId,uid:m.uid,validity:m.validity});if(r!==undefined){m.body=r;m.loaded=true;render();}}};}
 if(!visible.length){const empty=text('div','',el('messages'),'empty-state');icon('inbox',empty);text('p',loading?'Loading inboxes…':accounts.length||demo?'No messages here.':'Add an account to get started.',empty);if(!accounts.length&&!demo){const add=text('button','Add account',empty);add.onclick=()=>openAccounts('add');}}
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
 document.querySelectorAll('[data-count]').forEach(n=>{const count=messages.filter(m=>inView(m,n.dataset.count)&&(['flagged','junk','trash'].includes(n.dataset.count)||m.unread)).length;n.textContent=count||'';});el('empty-folder').hidden=!demo||!['junk','trash'].includes(mailboxScope().folder);el('empty-folder').textContent=mailboxScope().folder==='junk'?'Empty Junk…':'Empty Deleted Items…';renderReader(visible);
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;selectedId=null;render();});
el('search').oninput=render;
for(const [id,value] of [['filter-all',false],['filter-unread',true]])el(id).onclick=()=>{unreadOnly=value;el('filter-all').setAttribute('aria-pressed',String(!value));el('filter-unread').setAttribute('aria-pressed',String(value));render();};
el('density').onclick=()=>{const compact=document.body.classList.toggle('compact');el('density').setAttribute('aria-label',compact?'Use comfortable message spacing':'Use compact message spacing');};
el('refresh').onclick=()=>demo?notice('Sample mail; changes reset on reload.'):refreshAccounts();
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const m=messages.find(m=>m.id===selectedId);if(!m||!demo)return;const action=b.dataset.action;if(action==='flag')m.flagged=!m.flagged;else if(action==='unread')m.unread=!m.unread;else{m.folder=action;notice(`Sample message moved to ${names[action]}. Changes reset on reload.`);}render();});
el('rules-toggle').onclick=()=>el('rules').showModal();el('rules-close').onclick=()=>el('rules').close();
el('rule-form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target);el('preview').replaceChildren();try{const rule=validateRule({id:'preview',enabled:true,accountId:data.get('account')==='all'?undefined:data.get('account'),match:'all',conditions:[{field:'subject',operator:'contains',value:data.get('term')}],actions:[{type:data.get('action'),value:data.get('value')}],stopProcessing:true});const plans=messages.filter(m=>m.folder==='inbox').flatMap(m=>planRules(m,[rule]));text('strong',`${plans.length} matching inbox message(s) · preview only`,el('preview'));for(const p of plans)text('p',`${messages.find(m=>m.id===p.messageId).subject} → ${p.actions[0].type}${p.actions[0].value?': '+p.actions[0].value:''}`,el('preview'));}catch(err){text('p',err.message,el('preview'));}};
render();

let pendingFolder = null;
const mailboxLabel = folder => folder === 'junk' ? 'Junk' : 'Deleted Items';
function requestEmpty(folder, accountId) {
 if(!demo){notice('Changing live mail is not available in this read-only alpha.');return;}
 if (!['junk','trash'].includes(folder)) return;
 const count=messages.filter(m=>m.folder===folder&&(!accountId||m.accountId===accountId)).length;
 if(!count){notice(`${mailboxLabel(folder)} is already empty.`);return;}
 pendingFolder={folder,accountId};
 el('empty-title').textContent=`Empty ${mailboxLabel(folder)}?`;
 el('empty-description').textContent=`Remove all ${count} sample message(s) from ${mailboxLabel(folder)} ${accountId ? 'in '+accountName(accountId) : 'across both sample accounts'}? Search and unread filters do not limit this action. This preview resets on reload; real mail is not connected.`;
 el('empty-confirm').showModal();el('empty-cancel').focus();
}
el('empty-folder').onclick=()=>{const {folder,accountId}=mailboxScope();requestEmpty(folder,accountId);};
el('empty-cancel').onclick=()=>el('empty-confirm').close();
el('empty-confirm').addEventListener('close',()=>{pendingFolder=null;});
el('empty-approve').onclick=()=>{if(!pendingFolder)return;const {folder,accountId}=pendingFolder;messages=emptyMailbox(messages,folder,accountId);el('empty-confirm').close();render();notice(`${mailboxLabel(folder)} emptied. Sample data resets on reload.`);};
for(const button of document.querySelectorAll('[data-view]')){
 const {folder,accountId}=mailboxScope(button.dataset.view);if(!['junk','trash'].includes(folder))continue;
 button.addEventListener('contextmenu',async event=>{
  event.preventDefault();
  if(window.desktopMail){try{if(await window.desktopMail.chooseMailboxAction(folder)==='empty')requestEmpty(folder,accountId);}catch{notice('Mailbox menu unavailable. Use the Empty button in this mailbox.');}}
  else {el('mailbox-context-title').textContent=mailboxLabel(folder);el('context-empty').textContent=`Empty ${mailboxLabel(folder)}…`;el('context-empty').onclick=()=>{el('mailbox-context').close();requestEmpty(folder,accountId);};el('mailbox-context').showModal();}
 });
}
el('context-close').onclick=()=>el('mailbox-context').close();
window.desktopMail?.onMailboxCommand(requestEmpty);
const mode=document.querySelector('.local-note');
mode.firstChild.textContent=window.desktopMail?'Desktop alpha':'Browser preview';
if(!window.desktopMail)mode.querySelector('span').textContent='Run pnpm desktop for native Mac/Windows menus.';

function closeWindowMenus(){document.querySelectorAll('.window-menu details').forEach(menu=>menu.open=false);}
function openAccounts(mode='manage'){
 closeWindowMenus();el('accounts-title').textContent=mode==='add'?'Add Account':'Accounts';
 el('accounts-description').textContent='Add or remove your own accounts. Removing an account only removes its credentials and loaded mail from this app.';
 el('account-form').hidden=!window.desktopMail;
 el('account-list').replaceChildren();
 for(const a of accounts){const row=text('p',a.email+' ',el('account-list'));const remove=text('button','Remove account',row);remove.onclick=async()=>{if(!confirm('Remove '+a.email+' from Made Mail? Mail on the server will remain.'))return;await api('remove',a.id);await refreshAccounts();openAccountList();};}
 if(!window.desktopMail)text('p','Account connections are available in the installed desktop app.',el('account-list'));
 if(!el('accounts').open)el('accounts').showModal();
}
function openAccountList(){openAccounts();}
document.querySelectorAll('[data-open-accounts]').forEach(button=>button.onclick=()=>openAccounts(button.dataset.openAccounts));
el('accounts-close').onclick=()=>el('accounts').close();
window.desktopMail?.onAccountsCommand(openAccounts);
el('menu-density').onclick=()=>{closeWindowMenus();el('density').click();};
el('menu-rules').onclick=()=>{closeWindowMenus();el('rules').showModal();};
document.querySelectorAll('[data-menu-empty]').forEach(button=>button.onclick=()=>{closeWindowMenus();requestEmpty(button.dataset.menuEmpty);});
el('menu-about').onclick=()=>{closeWindowMenus();el('about').showModal();};el('about-close').onclick=()=>el('about').close();
document.querySelectorAll('.window-menu details').forEach(menu=>menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll('.window-menu details').forEach(other=>{if(other!==menu)other.open=false;});}));
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeWindowMenus();});
document.addEventListener('click',event=>{if(!event.target.closest('.window-menu'))closeWindowMenus();});

for(const name of ['home','view','help'])el(`tab-${name}`).onclick=()=>{
 for(const panel of ['home','view','help']){el(`ribbon-${panel}`).hidden=panel!==name;el(`tab-${panel}`).setAttribute('aria-selected',String(panel===name));}
};
el('ribbon-rules').onclick=()=>el('rules').showModal();
el('ribbon-accounts').onclick=()=>openAccounts();
el('ribbon-about').onclick=()=>el('about').showModal();
el('ribbon-density').onclick=()=>el('density').click();
for(const layout of ['preview','columns'])el(`layout-${layout}`).onclick=()=>{
 document.body.dataset.mailLayout=layout;
 el('layout-preview').setAttribute('aria-pressed',String(layout==='preview'));
 el('layout-columns').setAttribute('aria-pressed',String(layout==='columns'));
};

const ribbonTabs=[...document.querySelectorAll('.ribbon-tabs [role="tab"]')];
for(const [index,tab] of ribbonTabs.entries())tab.addEventListener('keydown',event=>{
 const next=event.key==='ArrowRight'?(index+1)%ribbonTabs.length:event.key==='ArrowLeft'?(index+ribbonTabs.length-1)%ribbonTabs.length:event.key==='Home'?0:event.key==='End'?ribbonTabs.length-1:null;
 if(next!==null){event.preventDefault();ribbonTabs[next].focus();ribbonTabs[next].click();}
});

const demoTree=document.querySelector('.account-tree').innerHTML;
function rebuildAccounts(){
 const tree=document.querySelector('.account-tree');tree.replaceChildren();
 if(demo){tree.innerHTML=demoTree;}else for(const a of accounts){const details=text('details','',tree,'mail-account');details.open=true;text('summary',a.email,details);const b=text('button','Inbox',details,'nav-item');b.dataset.view=a.id+':inbox';names[b.dataset.view]=a.email+' · Inbox';}
 tree.querySelectorAll('[data-view]').forEach(b=>{b.onclick=()=>{view=b.dataset.view;selectedId=null;render();};const {folder,accountId}=mailboxScope(b.dataset.view);if(['junk','trash'].includes(folder))b.oncontextmenu=async event=>{event.preventDefault();if(window.desktopMail){try{if(await window.desktopMail.chooseMailboxAction(folder)==='empty')requestEmpty(folder,accountId);}catch{notice('Use the Empty button in this mailbox.');}}else requestEmpty(folder,accountId);};});
 const select=document.querySelector('#rule-form [name="account"]');select.replaceChildren();const all=text('option','All accounts',select);all.value='all';for(const a of demo?[{id:'work',email:'alex@northstar.example'},{id:'personal',email:'alex@icloud.example'}]:accounts){const o=text('option',a.email,select);o.value=a.id;}
 document.querySelector('.demo-status').textContent=demo?'Sample mail':accounts.length+' account(s)';
 document.querySelector('.ribbon-preview').textContent=demo?'Demo · fictional mail':'Read-only desktop alpha';
 mode.querySelector('span').textContent=demo?'Fictional mail · changes reset on reload':'Live IMAP inboxes · latest 30 per account';
}
async function api(name,input){try{const result=await window.desktopMail.accounts[name](input);if(!result.ok)throw new Error(result.error);return result.data;}catch(error){notice(error.message||'Account operation failed.');return undefined;}}
async function refreshAccounts(){
 if(loading)return;loading=true;el('refresh').setAttribute('aria-busy','true');demo=false;messages=[];view='inbox';render();
 try{const list=await api('list');if(!list)return;accounts=list;rebuildAccounts();for(const a of accounts){const inbox=await api('inbox',a.id);if(inbox)messages.push(...inbox);}messages.sort((a,b)=>new Date(b.receivedAt)-new Date(a.receivedAt));}finally{loading=false;el('refresh').setAttribute('aria-busy','false');render();}
}
el('account-form').onsubmit=async event=>{
 event.preventDefault();const form=event.target,submit=form.querySelector('[type="submit"]');submit.disabled=true;
 const input=Object.fromEntries(new FormData(form));el('account-status').textContent='Connecting securely…';
 try{const added=await api('add',input);if(added){form.reset();el('account-status').textContent='Account added. Loading inbox…';await refreshAccounts();openAccountList();}else el('account-status').textContent='Could not add account. Check your public IMAP server and app password. OAuth-only accounts are not supported yet.';}finally{form.elements.password.value='';input.password='';submit.disabled=false;}
};
el('demo-mode').onclick=()=>{el('accounts').close();if(loading)return;demo=true;messages=structuredClone(demoMessages);view='inbox';rebuildAccounts();render();};
el('accounts').addEventListener('close',()=>{el('account-form').elements.password.value='';});
rebuildAccounts();render();
if(window.desktopMail)refreshAccounts();

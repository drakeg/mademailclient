document.documentElement.dataset.shell = window.desktopMail?.isDesktop ? 'desktop' : 'browser';
import {createMailTools} from '/apps/web/mail-tools.mjs';
import {createRuleEditor} from '/apps/web/rule-editor.mjs';
import {createComposer,canSendAccount} from '/apps/web/composer.mjs';
import { messageCommands, applyDemoMessageAction } from '/packages/core/message-actions.mjs';
import { planRules, validateRule } from '/packages/core/rules.mjs';
import { createAccountSetup } from '/apps/web/account-setup.mjs';
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
let demo=false, accounts=[], loading=false,actionBusy=false;
let savedFolderSettings=[];
const bodyRequests=new Map();
let accountQueue=Promise.resolve();
const foldersByAccount=new Map(), folderPages=new Map();
let view='inbox', unreadOnly=false, selectedId='1', noticeTimer;
const el=id=>document.getElementById(id);
const text=(tag,value,parent,className)=>{const n=document.createElement(tag);n.textContent=value;if(className)n.className=className;parent.append(n);return n;};
const icon=(name,parent)=>{const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('class','icon');n.setAttribute('aria-hidden','true');const use=document.createElementNS(n.namespaceURI,'use');use.setAttribute('href',`#i-${name}`);n.append(use);parent.append(n);return n;};
const names={inbox:'All inboxes',work:'alex@northstar.example',personal:'alex@icloud.example',sent:'Sent',projects:'Projects',unread:'Unread',flagged:'Flagged',archive:'Archive',junk:'Junk',trash:'Deleted items','work:sent':'Work · Sent','personal:sent':'Personal · Sent','work:projects':'Work · Projects'};
const accountName=id=>accounts.find(a=>a.id===id)?.email||(id==='work'?'alex@northstar.example':'alex@icloud.example');
const folderNames={inbox:'Inbox',drafts:'Drafts',sent:'Sent Items',trash:'Deleted Items',junk:'Junk Email',archive:'Archive',projects:'Projects'};
for(const account of ['work','personal'])for(const folder of Object.keys(folderNames))names[`${account}:${folder}`]=`${accountName(account)} · ${folderNames[folder]}`;
function mailboxScope(target=view){if(target.includes(':')){const [accountId,folder]=target.split(':');return {folder,accountId};}return ['work','personal'].includes(target)?{folder:'inbox',accountId:target}:{folder:target};}

function roleOf(message){
 if(!message)return undefined;
 if(demo)return message?.folder;
 const saved=savedFolderSettings.find(s=>s.id===message?.accountId)?.folders||{};
 for(const role of ['trash','junk','archive'])if(saved[role]&&saved[role]===message?.path)return role;
 const use=foldersByAccount.get(message?.accountId)?.find(f=>f.path===message?.path)?.specialUse;
 return ({'\\Trash':'trash','\\Junk':'junk','\\Archive':'archive'})[use]||message?.folder;
}
function canModify(message){const a=accounts.find(a=>a.id===message?.accountId);return !actionBusy&&(demo||!!a&&(a.authType!=='oauth2'||a.provider==='google'));}
function commandMessage(message){return message?{...message,folder:roleOf(message)}:message;}
function inView(m,target=view){
 if(target==='work'||target==='personal')return m.accountId===target&&m.folder==='inbox';
 if(target.includes(':')){const [account,folder]=target.split(':');return m.accountId===account&&m.folder===folder;}
 if(target==='unread')return m.unread&&m.folder==='inbox';
 if(target==='flagged')return m.flagged&&!['trash','junk'].includes(roleOf(m));
 return m.folder===target;
}
function visibleMessages(){const term=el('search').value.toLowerCase();return messages.filter(m=>inView(m)&&(!unreadOnly||m.unread)&&[m.from,m.subject,m.body].some(v=>v.toLowerCase().includes(term)));}
function notice(value){el('notice').textContent=value;el('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{el('notice').hidden=true;},4500);}
function renderReader(visible){
 const m=visible.find(m=>m.id===selectedId);el('reader').replaceChildren();
 const commands=messageCommands(commandMessage(m),{canModify:canModify(m),canSend:!demo&&canSendAccount(accounts.find(a=>a.id===m?.accountId))});
 document.querySelectorAll('[data-action]').forEach(b=>{const state=commands[b.dataset.action];b.disabled=!state.enabled;b.hidden=!state.visible;b.title=state.reason||state.label;b.setAttribute('aria-label',state.label);const label=b.querySelector('span');if(label)label.textContent=state.label;else b.textContent=state.label;});
 window.desktopMail?.setMessageMenuState({selected:!!m,canModify:canModify(m),canSend:!demo&&canSendAccount(accounts.find(a=>a.id===m?.accountId)),junk:['junk','spam'].includes(roleOf(m)),unread:!!m?.unread,flagged:!!m?.flagged,trash:roleOf(m)==='trash',archive:roleOf(m)==='archive'});
 el('reader-capabilities').textContent=demo?'Sample message changes reset on reload. Sending is not available yet.':m?(actionBusy?'Saving mailbox change…':canModify(m)?'Changes are saved to the mail server. Delete moves to Trash; use Folder Settings if a destination is missing.':'This authorization is read-only. Reconnect with a supported write grant or app-password account.'):'Select a message to see available actions.';
 el('reader-position').textContent=m?`${visible.indexOf(m)+1} of ${visible.length}`:'';
 if(!m){const empty=text('div','',el('reader'),'empty-state');icon('mail',empty);text('h2','No message selected',empty);text('p','Choose a message to read it here.',empty);return;}
 const label=text('div','',el('reader'),'reader-label');text('i','',label,`account-dot ${m.accountId}`);text('span',`${accountName(m.accountId)} / ${m.folder==='inbox'?'Inbox':foldersByAccount.get(m.accountId)?.find(f=>f.path===m.path)?.name||m.folder}`,label);
 text('h2',m.subject,el('reader'));
 const sender=text('div','',el('reader'),'sender-card');text('div',m.from.split(' ').slice(0,2).map(w=>w[0]).join(''),sender,'avatar');const info=text('div','',sender,'sender-info');text('strong',m.from,info);text('p',`${m.email} → ${m.to}`,info);text('span',m.time,sender,'sender-date');
 text('div',m.body,el('reader'),'message-body');
 if(m.hasAttachment){const attachment=text('div','',el('reader'),'attachment');icon('paperclip',attachment);const info=text('div','',attachment);text('strong',m.attachment,info);text('small','Sample attachment · preview only',info);}
 document.querySelectorAll('[data-action="flag"]').forEach(button=>button.setAttribute('aria-pressed',String(!!m.flagged)));
 document.querySelectorAll('[data-action="unread"]').forEach(button=>button.setAttribute('aria-pressed',String(!!m.unread)));
}
function render(){
 el('load-older').hidden=demo||!view.includes(':');el('load-older').disabled=loading;
 const visible=visibleMessages();if(!visible.some(m=>m.id===selectedId))selectedId=visible[0]?.id;
 el('mailbox-title').textContent=names[view]||accountName(view.split(':')[0]);el('mailbox-summary').textContent=`${visible.length} message${visible.length===1?'':'s'} · ${visible.filter(m=>m.unread).length} unread`;
 el('messages').replaceChildren();let group;
 for(const m of visible){if(group!==m.date){group=m.date;text('div',group,el('messages'),'date-heading');}const b=text('button','',el('messages'),`message${m.unread?' unread':''}${selectedId===m.id?' selected':''}`);b.setAttribute('aria-pressed',String(selectedId===m.id));b.setAttribute('aria-label',`${m.from}: ${m.subject}, ${m.time}, ${accountName(m.accountId)}${m.unread?', unread':''}`);if(m.unread)text('span','',b,'unread-dot');text('span',m.from.split(' ').slice(0,2).map(w=>w[0].toUpperCase()).join(''),b,'message-avatar');const row=text('div','',b,'message-top');text('span',m.from,row,'sender');text('time',m.time,row);text('span',m.subject,b,'subject');text('span',m.body.replaceAll('\n',' '),b,'snippet');const meta=text('div','',b,'message-meta');text('i','',meta,`account-dot ${m.accountId}`);text('span',accountName(m.accountId),meta);if(m.hasAttachment)icon('paperclip',meta);if(m.flagged)icon('flag',meta);b.onclick=async()=>{selectedId=m.id;render();await loadSelectedBody(true);}}
 if(!visible.length){const empty=text('div','',el('messages'),'empty-state');icon('inbox',empty);text('p',loading?'Loading inboxes…':accounts.length||demo?'No messages here.':'Choose File → Add Account… to get started.',empty);}
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
 document.querySelectorAll('[data-count]').forEach(n=>{const count=messages.filter(m=>inView(m,n.dataset.count)&&(['flagged','junk','trash'].includes(n.dataset.count)||m.unread)).length;n.textContent=count||'';});el('empty-folder').hidden=!demo||!['junk','trash'].includes(mailboxScope().folder);el('empty-folder').textContent=mailboxScope().folder==='junk'?'Empty Junk…':'Empty Deleted Items…';renderReader(visible);
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=async()=>{view=b.dataset.view;selectedId=null;render();await loadSelectedBody(true);});
el('search').oninput=render;
for(const [id,value] of [['filter-all',false],['filter-unread',true]])el(id).onclick=()=>{unreadOnly=value;el('filter-all').setAttribute('aria-pressed',String(!value));el('filter-unread').setAttribute('aria-pressed',String(value));render();};
el('density').onclick=()=>{const compact=document.body.classList.toggle('compact');el('density').setAttribute('aria-label',compact?'Use comfortable message spacing':'Use compact message spacing');};
el('refresh').onclick=()=>demo?notice('Sample mail; changes reset on reload.'):refreshAccounts();
async function performMessageAction(action){
 try{
 closeWindowMenus();const m=messages.find(m=>m.id===selectedId);
 if(action==='folderSettings'){await mailTools.folderSettings();return;}
 if(action==='actionHistory'){await mailTools.history();return;}
 if(action==='move'){if(demo){notice('Move to Folder is available for connected accounts.');return;}mailTools.move(m);return;}
 if(action==='compose'){composer.open();return;}
 if(action==='outgoing'){await composer.showRecords();return;}
 if(['reply','replyAll','forward'].includes(action)&&!demo&&m){await loadSelectedBody();if(!m.loaded){notice('Load message text before replying or forwarding.');return;}composer.open(action,m);return;}
 if(!messageCommands(commandMessage(m),{canModify:canModify(m),canSend:!demo&&canSendAccount(accounts.find(a=>a.id===m?.accountId))})[action]?.enabled)return;
 if(!demo){
  actionBusy=true;render();
  try{const actual=action==='unread'?(m.unread?'markRead':'markUnread'):action==='flag'?(m.flagged?'unflag':'flag'):action;await mailTools.apply(m,actual);if(['archive','trash','junk','notJunk'].includes(action))messages=messages.filter(item=>item.id!==m.id);else if(action==='unread')m.unread=!m.unread;else if(action==='flag')m.flagged=!m.flagged;await refreshAccounts();notice('Mailbox change saved to the server.');}catch(e){notice(e.message);}finally{actionBusy=false;render();}return;
 }
 messages=messages.map(item=>item.id===m.id?applyDemoMessageAction(item,action):item);
 render();notice(action==='notJunk'?'Sample message moved to Inbox.':action==='junk'?'Sample message moved to Junk.':action==='trash'?'Sample message moved to Deleted Items.':'Sample message updated.');
 }catch(error){notice(error.message||'Mail action failed.');}
}
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>performMessageAction(b.dataset.action));
el('rules-close').onclick=()=>el('rules').close();

render();

let pendingFolder = null;
const mailboxLabel = folder => folder === 'junk' ? 'Junk' : 'Deleted Items';
function requestEmpty(folder, accountId) {
 if(!demo){notice('Select messages and Delete to move them to Trash. Permanently emptying a connected mailbox is not available.');return;}
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
mode.firstChild.textContent=window.desktopMail?'Made Mail':'Browser preview';
if(!window.desktopMail)mode.querySelector('span').textContent='Run pnpm desktop for native Mac/Windows menus.';

function closeWindowMenus(){document.querySelectorAll('.window-menu details').forEach(menu=>menu.open=false);}
const accountSetup=createAccountSetup({el,text,desktop:window.desktopMail,getAccounts:()=>accounts,refreshAccounts,closeWindowMenus});
function openAccounts(mode='manage'){accountSetup.open(mode);}
document.querySelectorAll('[data-open-accounts]').forEach(button=>button.onclick=()=>openAccounts(button.dataset.openAccounts));
el('accounts-close').onclick=()=>el('accounts').close();
window.desktopMail?.onAccountsCommand(openAccounts);
el('menu-density').onclick=()=>{closeWindowMenus();el('density').click();};
el('menu-rules').onclick=()=>{closeWindowMenus();ruleEditor.open();};
el('menu-folder-settings').onclick=()=>performMessageAction('folderSettings');
el('menu-action-history').onclick=()=>performMessageAction('actionHistory');
document.querySelectorAll('[data-menu-empty]').forEach(button=>button.onclick=()=>{closeWindowMenus();requestEmpty(button.dataset.menuEmpty);});
el('menu-about').onclick=()=>{closeWindowMenus();el('about').showModal();};el('about-close').onclick=()=>el('about').close();
document.querySelectorAll('.window-menu details').forEach(menu=>menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll('.window-menu details').forEach(other=>{if(other!==menu)other.open=false;});}));
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeWindowMenus();});
document.addEventListener('click',event=>{if(!event.target.closest('.window-menu'))closeWindowMenus();});

function setLayout(layout){
 document.body.dataset.mailLayout=layout;
 el('layout-preview').setAttribute('aria-pressed',String(layout==='preview'));
 el('layout-columns').setAttribute('aria-pressed',String(layout==='columns'));
}
for(const layout of ['preview','columns'])el(`layout-${layout}`).onclick=()=>{closeWindowMenus();setLayout(layout);};
window.desktopMail?.onMenuCommand(command=>{
 if(command==='rules'){closeWindowMenus();ruleEditor.open();}
 else if(['preview','columns'].includes(command))setLayout(command);
 else if(command==='density')el('density').click();
 else performMessageAction(command);
});

const mailTools=createMailTools({el,text,getAccounts:()=>accounts,getFolders:id=>foldersByAccount.get(id)||[],refresh:refreshAccounts,notice});
const ruleEditor=createRuleEditor({el,text,getAccounts:()=>accounts,getFolders:id=>foldersByAccount.get(id)||[],getMessages:()=>messages,isDemo:()=>demo,refresh:refreshAccounts,notice});
const composer=createComposer({el,text,getAccounts:()=>accounts,notice});
el('menu-compose').onclick=()=>{closeWindowMenus();composer.open();};
el('menu-outgoing').onclick=()=>{closeWindowMenus();composer.showRecords();};
const demoTree=document.querySelector('.account-tree').innerHTML;
function rebuildAccounts(){
 const tree=document.querySelector('.account-tree');tree.replaceChildren();
 if(demo){tree.innerHTML=demoTree;}else for(const a of accounts){const details=text('details','',tree,'mail-account');details.open=true;text('summary',a.email,details);for(const f of foldersByAccount.get(a.id)||[{path:'INBOX',name:'Inbox',key:'inbox'}]){const b=text('button',f.name,details,'nav-item');b.dataset.view=a.id+':'+f.key;names[b.dataset.view]=a.email+' · '+f.name;}}
 tree.querySelectorAll('[data-view]').forEach(b=>{b.onclick=async()=>{view=b.dataset.view;selectedId=null;render();if(!demo)await loadCurrentFolder(false,true);};const {folder,accountId}=mailboxScope(b.dataset.view);if(['junk','trash'].includes(folder))b.oncontextmenu=async event=>{event.preventDefault();if(window.desktopMail){try{if(await window.desktopMail.chooseMailboxAction(folder)==='empty')requestEmpty(folder,accountId);}catch{notice('Use the Empty button in this mailbox.');}}else requestEmpty(folder,accountId);};});
 const select=document.querySelector('#rule-form [name="account"]'),previousAccount=select.value;select.replaceChildren();const all=text('option',demo?'All accounts':'Choose account…',select);all.value='all';for(const a of demo?[{id:'work',email:'alex@northstar.example'},{id:'personal',email:'alex@icloud.example'}]:accounts){const o=text('option',a.email,select);o.value=a.id;}if([...select.options].some(o=>o.value===previousAccount))select.value=previousAccount;
 document.querySelector('.demo-status').textContent=demo?'Sample mail':accounts.length+' account(s)';
 el('connection-state').textContent=demo?'Demo · fictional mail':'Connected desktop preview';
 mode.querySelector('span').textContent=demo?'Fictional mail · changes reset on reload':'Live folders · refresh every minute while open';
}
async function api(name,input){
 const task=accountQueue.then(async()=>{try{const result=await window.desktopMail.accounts[name](input);if(!result.ok)throw new Error(result.error);return result.data;}catch(error){notice(error.message||'Account operation failed.');return undefined;}});accountQueue=task.catch(()=>{});return task;
}
async function loadSelectedBody(markRead=false){
 const m=messages.find(m=>m.id===selectedId);if(demo||!m?.uid)return;
 if(!m.loaded){
  let pending=bodyRequests.get(m.id);
  if(!pending){pending=api('body',{accountId:m.accountId,uid:m.uid,validity:m.validity,path:m.path});bodyRequests.set(m.id,pending);}
  try{const body=await pending;if(body!==undefined){const current=messages.find(item=>item.id===m.id);if(current){current.body=body;current.loaded=true;}m.body=body;m.loaded=true;render();}}finally{bodyRequests.delete(m.id);}
 }
 if(markRead&&m.loaded&&m.unread&&canModify(m))try{await mailTools.apply(m,'markRead');m.unread=false;render();}catch(e){notice(e.message);}
}
async function fetchPage(accountId,path='INBOX',older=false){
 const key=accountId+':'+path,previous=folderPages.get(key);
 if(older&&!previous?.before)return;
 const result=await api('folder',{accountId,path,...(older?{before:previous.before,validity:previous.validity}:{})});
 if(!result)return;
 if(result.ruleError)notice(result.ruleError);
 if(!older)messages=messages.filter(m=>m.accountId!==accountId||m.path!==path);
 const ids=new Set(messages.map(m=>m.id));messages.push(...result.messages.filter(m=>!ids.has(m.id)));
 folderPages.set(key,result);
}
async function loadCurrentFolder(older=false,markRead=false){
 if(loading||demo||!view.includes(':'))return;
 const [accountId,key]=view.split(':'),folder=foldersByAccount.get(accountId)?.find(f=>f.key===key);
 if(!folder)return;
 loading=true;el('refresh').setAttribute('aria-busy','true');
 try{await fetchPage(accountId,folder.path,older);}finally{loading=false;el('refresh').setAttribute('aria-busy','false');render();}
 await loadSelectedBody(markRead);
}
async function refreshAccounts(){
 if(loading)return;loading=true;el('refresh').setAttribute('aria-busy','true');
 if(demo){messages=[];view='inbox';}demo=false;render();
 try{const list=await api('list');if(!list)return;accounts=list;try{savedFolderSettings=await mailTools.settings();}catch{}messages=messages.filter(m=>accounts.some(a=>a.id===m.accountId));for(const a of accounts){const folders=await api('folders',a.id);if(folders)foldersByAccount.set(a.id,folders);await fetchPage(a.id);}rebuildAccounts();messages.sort((a,b)=>new Date(b.receivedAt)-new Date(a.receivedAt));}finally{loading=false;el('refresh').setAttribute('aria-busy','false');render();}
 if(view.includes(':'))await loadCurrentFolder();else await loadSelectedBody();
}
el('load-older').onclick=()=>loadCurrentFolder(true);
if(window.desktopMail)setInterval(()=>{if(!demo&&!loading&&!document.querySelector('dialog[open]'))refreshAccounts();},60000);
el('demo-mode').onclick=()=>{el('accounts').close();if(loading)return;demo=true;messages=structuredClone(demoMessages);view='inbox';rebuildAccounts();render();};
rebuildAccounts();render();
if(window.desktopMail)refreshAccounts();

for(const menu of document.querySelectorAll('.window-menu details'))menu.addEventListener('keydown',event=>{
 const summary=menu.querySelector('summary'),items=[...menu.querySelectorAll('button:not(:disabled):not([hidden])')];
 if(event.key==='Escape'){event.preventDefault();menu.open=false;summary.focus();return;}
 if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const all=[...document.querySelectorAll('.window-menu details')],index=all.indexOf(menu),next=all[(index+(event.key==='ArrowRight'?1:all.length-1))%all.length];menu.open=false;next.open=true;next.querySelector('summary').focus();return;}
 if(!items.length)return;
 const index=items.indexOf(document.activeElement);
 if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();menu.open=true;const next=event.key==='Home'?0:event.key==='End'?items.length-1:event.key==='ArrowDown'?(index+1)%items.length:(index<0?items.length-1:(index+items.length-1)%items.length);items[next].focus();}
});

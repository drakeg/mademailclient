document.documentElement.dataset.shell = window.desktopMail?.isDesktop ? 'desktop' : 'browser';
import { planRules, validateRule } from '/packages/core/rules.mjs';
import { emptyMailbox } from '/packages/core/mailboxes.mjs';
let messages = [
{id:'1',accountId:'work',from:'Morgan Chen',email:'morgan@studio.example',to:'you@work.example',subject:'Brand direction — ready for your thoughts',body:'Hi there,\n\nI’ve pulled together the updated brand direction following our conversation on Monday. The new approach gives us a little more room to work with, while keeping the clarity we liked in the original.\n\nA few things to look at:\n\n• A simpler visual system across desktop and mobile\n• Warmer photography and a more considered color palette\n• A clearer hierarchy for the things that matter most\n\nWould love to hear what you think before we share it with the wider team on Friday. No rush today — tomorrow morning works well.\n\nThanks,\nMorgan\nDesign team',unread:true,time:'10:42 AM',date:'Today',folder:'inbox'},
{id:'3',accountId:'work',from:'Studio billing',email:'billing@studio.example',to:'you@work.example',subject:'Your October invoice',body:'Hello,\n\nYour October invoice is ready for review. You’ll find a summary attached.\n\nThank you for being part of the studio. If you have any questions, just reply to this email.\n\nBest,\nThe Studio team',hasAttachment:true,attachment:'October-invoice.pdf',unread:true,time:'9:18 AM',date:'Today',folder:'inbox'},
{id:'4',accountId:'personal',from:'Alex Rivera',email:'alex@friends.example',to:'you@personal.example',subject:'Dinner next week?',body:'Hey!\n\nLet’s find an evening for dinner next week. Tuesday or Thursday? There’s a new place on the corner I’ve been meaning to try.\n\nHope your week is going well.\nAlex',unread:true,time:'8:54 AM',date:'Today',folder:'inbox'},
{id:'5',accountId:'work',from:'Priya Shah',email:'priya@studio.example',to:'you@work.example',subject:'A few notes from our planning session',body:'Hi,\n\nThanks for a productive planning session. I’ve captured our next steps:\n\n1. Review the desktop prototype\n2. Confirm the account connection flow\n3. Share feedback with the team\n\nLet’s reconnect next week.\nPriya',flagged:true,time:'8:30 AM',date:'Today',folder:'inbox'},
{id:'2',accountId:'personal',from:'The neighborhood garden',email:'hello@garden.example',to:'you@personal.example',subject:'Saturday in the garden',body:'Hello neighbors,\n\nJoin us Saturday morning to plant the autumn beds. Bring a warm layer and a friend. Coffee will be ready at 9.\n\nSee you there,\nThe garden team',time:'Yesterday',date:'Yesterday',folder:'inbox'},
{id:'6',accountId:'work',from:'Daniel Park',email:'daniel@studio.example',to:'you@work.example',subject:'Re: Project timeline',body:'The revised timeline looks good to me. Thanks for making room for another round of feedback.\n\nDaniel',time:'Yesterday',date:'Yesterday',folder:'inbox'},
{id:'7',accountId:'personal',from:'Weekend reads',email:'editor@reading.example',to:'you@personal.example',subject:'Something worth slowing down for',body:'This week’s reading list is about making space: for good ideas, long walks, and conversations that go somewhere.\n\nEnjoy your weekend.',time:'Yesterday',date:'Yesterday',folder:'inbox'},
{id:'8',accountId:'work',from:'You',email:'you@work.example',to:'morgan@studio.example',subject:'Re: Kickoff notes',body:'Thanks Morgan. Looking forward to reviewing the next iteration.',time:'Yesterday',date:'Yesterday',folder:'sent'},
{id:'9',accountId:'personal',from:'You',email:'you@personal.example',to:'alex@friends.example',subject:'Photos from the weekend',body:'Such a good weekend. Let’s do it again soon!',time:'Monday',date:'Earlier',folder:'sent'},
{id:'10',accountId:'work',from:'Project team',email:'team@studio.example',to:'you@work.example',subject:'Project resources',body:'Here are the reference notes for the upcoming project.',time:'Monday',date:'Earlier',folder:'projects'}];
messages.push(
 {id:'junk1',accountId:'personal',from:'Sample promotions',email:'offers@example.invalid',to:'you@personal.example',subject:'A sample junk message',body:'Fictional mail for testing Empty Junk.',time:'Yesterday',date:'Yesterday',folder:'junk'},
 {id:'trash1',accountId:'work',from:'Sample notification',email:'notice@example.invalid',to:'you@work.example',subject:'A sample deleted message',body:'Fictional mail for testing Empty Deleted Items.',time:'Yesterday',date:'Yesterday',folder:'trash'}
);
let view='inbox', unreadOnly=false, selectedId='1', noticeTimer;
const el=id=>document.getElementById(id);
const text=(tag,value,parent,className)=>{const n=document.createElement(tag);n.textContent=value;if(className)n.className=className;parent.append(n);return n;};
const icon=(name,parent)=>{const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('class','icon');n.setAttribute('aria-hidden','true');const use=document.createElementNS(n.namespaceURI,'use');use.setAttribute('href',`#i-${name}`);n.append(use);parent.append(n);return n;};
const names={inbox:'All inboxes',work:'you@work.example',personal:'you@personal.example',sent:'Sent',projects:'Projects',unread:'Unread',flagged:'Flagged',archive:'Archive',junk:'Junk',trash:'Deleted items','work:sent':'Work · Sent','personal:sent':'Personal · Sent','work:projects':'Work · Projects'};
const accountName=id=>id==='work'?'you@work.example':'you@personal.example';
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
 document.querySelectorAll('[data-action]').forEach(b=>b.disabled=!m);
 el('reader-position').textContent=m?`${visible.indexOf(m)+1} of ${visible.length}`:'';
 if(!m){const empty=text('div','',el('reader'),'empty-state');icon('mail',empty);text('h2','No message selected',empty);text('p','Choose a message to read it here.',empty);return;}
 const label=text('div','',el('reader'),'reader-label');text('i','',label,`account-dot ${m.accountId}`);text('span',`${accountName(m.accountId)} / ${m.folder==='inbox'?'Inbox':m.folder}`,label);
 text('h2',m.subject,el('reader'));
 const sender=text('div','',el('reader'),'sender-card');text('div',m.from.split(' ').slice(0,2).map(w=>w[0]).join(''),sender,'avatar');const info=text('div','',sender,'sender-info');text('strong',m.from,info);text('p',`${m.email} → ${m.to}`,info);text('span',m.time,sender,'sender-date');
 text('div',m.body,el('reader'),'message-body');
 if(m.hasAttachment){const attachment=text('div','',el('reader'),'attachment');icon('paperclip',attachment);const info=text('div','',attachment);text('strong',m.attachment,info);text('small','Sample attachment · preview only',info);}
 const replies=text('div','',el('reader'),'reply-buttons');for(const [name,label] of [['reply','Reply'],['forward','Forward']]){const b=text('button','',replies);icon(name,b);text('span',label,b);b.disabled=true;b.title='Sending is coming with account connections';}
 document.querySelector('[data-action="flag"]').setAttribute('aria-pressed',String(!!m.flagged));
 document.querySelector('[data-action="unread"]').setAttribute('aria-pressed',String(!!m.unread));
}
function render(){
 const visible=visibleMessages();if(!visible.some(m=>m.id===selectedId))selectedId=visible[0]?.id;
 el('mailbox-title').textContent=names[view];el('mailbox-summary').textContent=`${visible.length} message${visible.length===1?'':'s'} · ${visible.filter(m=>m.unread).length} unread`;
 el('messages').replaceChildren();let group;
 for(const m of visible){if(group!==m.date){group=m.date;text('div',group,el('messages'),'date-heading');}const b=text('button','',el('messages'),`message${m.unread?' unread':''}${selectedId===m.id?' selected':''}`);b.setAttribute('aria-pressed',String(selectedId===m.id));b.setAttribute('aria-label',`${m.from}: ${m.subject}, ${m.time}, ${accountName(m.accountId)}${m.unread?', unread':''}`);if(m.unread)text('span','',b,'unread-dot');const row=text('div','',b,'message-top');text('span',m.from,row,'sender');text('time',m.time,row);text('span',m.subject,b,'subject');text('span',m.body.replaceAll('\n',' '),b,'snippet');const meta=text('div','',b,'message-meta');text('i','',meta,`account-dot ${m.accountId}`);text('span',accountName(m.accountId),meta);if(m.hasAttachment)icon('paperclip',meta);if(m.flagged)icon('flag',meta);b.onclick=()=>{selectedId=m.id;render();};}
 if(!visible.length){const empty=text('div','',el('messages'),'empty-state');icon('inbox',empty);text('p','No messages here.',empty);}
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
 document.querySelectorAll('[data-count]').forEach(n=>{const count=messages.filter(m=>inView(m,n.dataset.count)&&(['flagged','junk','trash'].includes(n.dataset.count)||m.unread)).length;n.textContent=count||'';});el('empty-folder').hidden=!['junk','trash'].includes(view);el('empty-folder').textContent=view==='junk'?'Empty Junk…':'Empty Deleted Items…';renderReader(visible);
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;selectedId=null;render();});
el('search').oninput=render;
for(const [id,value] of [['filter-all',false],['filter-unread',true]])el(id).onclick=()=>{unreadOnly=value;el('filter-all').setAttribute('aria-pressed',String(!value));el('filter-unread').setAttribute('aria-pressed',String(value));render();};
el('density').onclick=()=>{const compact=document.body.classList.toggle('compact');el('density').setAttribute('aria-label',compact?'Use comfortable message spacing':'Use compact message spacing');};
el('refresh').onclick=()=>notice('This preview uses sample mail. Live account synchronization is coming next.');
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const m=messages.find(m=>m.id===selectedId);if(!m)return;const action=b.dataset.action;if(action==='flag')m.flagged=!m.flagged;else if(action==='unread')m.unread=!m.unread;else{m.folder=action;notice(`Sample message moved to ${names[action]}. Changes reset on reload.`);}render();});
el('rules-toggle').onclick=()=>el('rules').showModal();el('rules-close').onclick=()=>el('rules').close();
el('rule-form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target);el('preview').replaceChildren();try{const rule=validateRule({id:'preview',enabled:true,accountId:data.get('account')==='all'?undefined:data.get('account'),match:'all',conditions:[{field:'subject',operator:'contains',value:data.get('term')}],actions:[{type:data.get('action'),value:data.get('value')}],stopProcessing:true});const plans=messages.filter(m=>m.folder==='inbox').flatMap(m=>planRules(m,[rule]));text('strong',`${plans.length} matching inbox message(s) · preview only`,el('preview'));for(const p of plans)text('p',`${messages.find(m=>m.id===p.messageId).subject} → ${p.actions[0].type}${p.actions[0].value?': '+p.actions[0].value:''}`,el('preview'));}catch(err){text('p',err.message,el('preview'));}};
render();

let pendingFolder = null;
const mailboxLabel = folder => folder === 'junk' ? 'Junk' : 'Deleted Items';
function requestEmpty(folder) {
 if (!['junk','trash'].includes(folder)) return;
 const count=messages.filter(m=>m.folder===folder).length;
 if(!count){notice(`${mailboxLabel(folder)} is already empty.`);return;}
 pendingFolder=folder;
 el('empty-title').textContent=`Empty ${mailboxLabel(folder)}?`;
 el('empty-description').textContent=`Remove all ${count} sample message(s) from ${mailboxLabel(folder)} across both sample accounts? Search and unread filters do not limit this action. This preview resets on reload; real mail is not connected.`;
 el('empty-confirm').showModal();el('empty-cancel').focus();
}
el('empty-folder').onclick=()=>requestEmpty(view);
el('empty-cancel').onclick=()=>el('empty-confirm').close();
el('empty-confirm').addEventListener('close',()=>{pendingFolder=null;});
el('empty-approve').onclick=()=>{if(!pendingFolder)return;const folder=pendingFolder;messages=emptyMailbox(messages,folder);el('empty-confirm').close();render();notice(`${mailboxLabel(folder)} emptied. Sample data resets on reload.`);};
for(const folder of ['junk','trash']){
 const button=document.querySelector(`[data-view="${folder}"]`);
 button.addEventListener('contextmenu',async event=>{
  event.preventDefault();
  if(window.desktopMail){try{if(await window.desktopMail.chooseMailboxAction(folder)==='empty')requestEmpty(folder);}catch{notice('Mailbox menu unavailable. Use the Empty button in this mailbox.');}}
  else {el('mailbox-context-title').textContent=mailboxLabel(folder);el('context-empty').textContent=`Empty ${mailboxLabel(folder)}…`;el('context-empty').onclick=()=>{el('mailbox-context').close();requestEmpty(folder);};el('mailbox-context').showModal();}
 });
}
el('context-close').onclick=()=>el('mailbox-context').close();
window.desktopMail?.onMailboxCommand(requestEmpty);
const mode=document.querySelector('.local-note');
mode.firstChild.textContent=window.desktopMail?'Desktop preview':'Browser preview';
if(!window.desktopMail)mode.querySelector('span').textContent='Run pnpm desktop for native Mac/Windows menus.';

function closeWindowMenus(){document.querySelectorAll('.window-menu details').forEach(menu=>menu.open=false);}
function openAccounts(mode='manage'){
 closeWindowMenus();el('accounts-title').textContent=mode==='add'?'Add Account':'Accounts';
 el('accounts-description').textContent=mode==='add'?'Connect an existing email address. Account connections are not available in this preview yet.':'These addresses identify fictional sample mailboxes, not connected accounts.';
 el('accounts').showModal();
}
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

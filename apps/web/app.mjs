import { planRules, validateRule } from '/packages/core/rules.mjs';
const messages = [
{id:'1',accountId:'work',from:'Morgan · Design team',to:'you@work.example',subject:'A fresh start for your inbox',body:'The new workspace is ready for review.\n\nEverything you need, a little easier to find.',unread:true},
{id:'2',accountId:'personal',from:'The neighborhood garden',to:'you@personal.example',subject:'Saturday in the garden',body:'Join us Saturday morning to plant the autumn beds. Bring a warm layer and a friend.',unread:false},
{id:'3',accountId:'work',from:'Studio billing',to:'you@work.example',subject:'Your October invoice',body:'Your monthly invoice is ready. Thanks for being part of the studio.',hasAttachment:true,unread:true},
{id:'4',accountId:'personal',from:'Alex',to:'you@personal.example',subject:'Dinner next week?',body:'Let’s find an evening for dinner next week. Tuesday or Thursday?',unread:true}];
let account='all';
const el = id=>document.getElementById(id);
const text = (tag,value,parent)=>{const n=document.createElement(tag);n.textContent=value;parent.append(n);return n;};
function render(){
 el('messages').replaceChildren();
 const term=el('search').value.toLowerCase();
 const visible=messages.filter(m=>(account==='all'||m.accountId===account)&&[m.subject,m.from,m.body].some(v=>v.toLowerCase().includes(term)));
 for(const m of visible){const b=text('button','',el('messages'));b.className='message';text('small',m.accountId.toUpperCase(),b);text('strong',m.from,b);text('span',m.subject,b);b.onclick=()=>{el('reader').replaceChildren();text('small',m.accountId.toUpperCase(),el('reader'));text('h2',m.subject,el('reader'));text('strong',m.from,el('reader'));text('p',m.body,el('reader'));};}
 if(!visible.length)text('p','No matching messages.',el('messages'));
 document.querySelectorAll('[data-account]').forEach(b=>b.classList.toggle('active',b.dataset.account===account));
}
document.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>{account=b.dataset.account;document.querySelector('.toolbar h2').textContent=account==='all'?'All inboxes':`${account==='work'?'Work':'Personal'} inbox`;el('reader').replaceChildren();text('p','Select a message to read.',el('reader'));render();});
el('search').oninput=render;
el('rules-toggle').onclick=()=>{el('rules').hidden=!el('rules').hidden;};
el('rule-form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target);el('preview').replaceChildren();try{const rule=validateRule({id:'preview',enabled:true,accountId:account==='all'?undefined:account,match:'all',conditions:[{field:'subject',operator:'contains',value:data.get('term')}],actions:[{type:data.get('action'),value:data.get('value')}],stopProcessing:true});const plans=messages.flatMap(m=>planRules(m,[rule]));text('strong',`${plans.length} matching message(s) · preview only`,el('preview'));for(const p of plans)text('p',`${messages.find(m=>m.id===p.messageId).subject} → ${p.actions[0].type}${p.actions[0].value ? ': '+p.actions[0].value : ''}`,el('preview'));}catch(err){text('p',err.message,el('preview'));}};
render();

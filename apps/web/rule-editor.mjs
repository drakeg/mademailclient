import {planRules} from '/packages/core/rules.mjs';
export function createRuleEditor({el,text,getAccounts,getFolders,getMessages,isDemo,refresh,notice,client=window.desktopMail?.rules}){
 const form=el('rule-form'),f=form.elements;let id,previewToken;
 const call=async(name,input)=>{if(!client)throw new Error('Use the desktop app to save and run rules.');const r=await client[name](input);if(!r.ok)throw new Error(r.error);return r.data;};
 function row(parent,condition={field:'subject',operator:'contains',value:''}){
  const r=text('div','',parent,'rule-condition');r.dataset.ruleCondition='';
  const select=(name,items)=>{const s=text('select','',r);s.setAttribute('aria-label',name);for(const [value,label] of items){const o=text('option',label,s);o.value=value;}return s;};
  const field=select('Condition field',[['subject','Subject'],['from','Sender email'],['to','Recipient']]);field.value=condition.field;
  const op=select('Condition operator',[['contains','contains'],['equals','equals']]);op.value=condition.operator;
  const value=text('input','',r);value.setAttribute('aria-label','Condition value');value.maxLength=1000;value.value=condition.value;
  const remove=text('button','Remove',r);remove.type='button';remove.onclick=()=>r.remove();
 }
 function readRows(parent){return [...parent.querySelectorAll('[data-rule-condition]')].map(r=>{const [field,operator,value]=r.querySelectorAll('select,input');return {field:field.value,operator:operator.value,value:value.value};});}
 function value(){return {id,name:f.ruleName.value,accountId:f.account.value,enabled:f.enabled.checked,stopProcessing:f.stopProcessing.checked,match:f.match.value,conditions:[{field:f.field.value,operator:f.operator.value,value:f.term.value},...readRows(el('rule-extra-conditions'))],exceptions:readRows(el('rule-exceptions')),actions:[{type:f.action.value,...(f.action.value==='move'?{value:f.value.value}:{})}]};}
 function options(){const list=el('rule-folder-options');list.replaceChildren();for(const folder of getFolders(f.account.value)){const o=text('option',folder.name,list);o.value=folder.path;}}
 f.account.addEventListener('change',options);
 function reset(){id=undefined;previewToken=undefined;f.ruleName.value='';f.term.value='';f.field.value='subject';f.operator.value='contains';f.match.value='all';f.action.value='move';f.value.value='';f.enabled.checked=true;f.stopProcessing.checked=true;el('rule-extra-conditions').replaceChildren();el('rule-exceptions').replaceChildren();el('rules-apply').hidden=true;el('preview').replaceChildren();}
 async function list(){
  const pane=el('saved-rules');pane.replaceChildren();if(isDemo()||!client){text('p','Sample rules can be previewed. Open the desktop app with an account to save rules.',pane);return;}
  const rules=await call('list');if(!rules.length)text('p','No saved rules. Create one below.',pane);
  for(const r of rules){const line=text('section','',pane,'saved-rule');text('strong',`${r.enabled?'Enabled':'Disabled'} · ${r.name}`,line);text('small',getAccounts().find(a=>a.id===r.accountId)?.email||'Removed account',line);
   const button=(label,run)=>{const b=text('button',label,line);b.type='button';b.onclick=async()=>{try{await run();}catch(e){notice(e.message);}};};
   button('Edit',()=>{reset();id=r.id;f.ruleName.value=r.name;f.account.value=r.accountId;f.enabled.checked=r.enabled;f.stopProcessing.checked=r.stopProcessing;f.match.value=r.match;const first=r.conditions[0];f.field.value=first.field;f.operator.value=first.operator;f.term.value=first.value;for(const c of r.conditions.slice(1))row(el('rule-extra-conditions'),c);for(const c of r.exceptions)row(el('rule-exceptions'),c);f.action.value=r.actions[0].type;f.value.value=r.actions[0].value||'';options();});
   button(r.enabled?'Disable':'Enable',async()=>{await call('save',{...r,enabled:!r.enabled});await list();});
   button('Up',async()=>{await call('reorder',{id:r.id,direction:'up'});await list();});button('Down',async()=>{await call('reorder',{id:r.id,direction:'down'});await list();});
   button('Delete rule',async()=>{if(!confirm('Delete this saved rule? Mail already changed by it is not undone.'))return;await call('remove',r.id);if(id===r.id)reset();await list();});
  }
 }
 el('rule-new').onclick=reset;el('rule-add-condition').onclick=()=>row(el('rule-extra-conditions'));el('rule-add-exception').onclick=()=>row(el('rule-exceptions'));
 el('rule-save').onclick=async()=>{el('rule-save').disabled=true;try{if(f.account.value==='all')throw new Error('Choose the account for this rule.');const saved=await call('save',value());id=saved.id;previewToken=undefined;el('rules-apply').hidden=true;await list();notice('Rule saved. Enabled rules apply to newly received inbox mail while Made Mail is open.');}catch(e){notice(e.message);}finally{el('rule-save').disabled=false;}};
 form.onsubmit=async e=>{
  e.preventDefault();el('preview').replaceChildren();previewToken=undefined;el('rules-apply').hidden=true;
  try{
   if(isDemo()){
    const rule={...value(),id:'preview',enabled:true,accountId:f.account.value==='all'?undefined:f.account.value};const matches=getMessages().filter(m=>m.folder==='inbox').flatMap(m=>planRules(m,[rule]));text('strong',`${matches.length} matching inbox message(s) · sample preview only`,el('preview'));return;
   }
   if(f.account.value==='all')throw new Error('Choose an account. Preview uses saved, enabled rules in their listed order.');
   const p=await call('preview',f.account.value);previewToken=p.token;text('strong',`${p.matches.length} matching inbox message(s) among ${p.total} recent messages · saved enabled rules`,el('preview'));for(const m of p.matches)text('p',m.subject,el('preview'));el('rules-apply').hidden=!p.matches.length;
  }catch(error){text('p',error.message,el('preview'));}
 };
 el('rules-apply').onclick=async()=>{if(!previewToken)return;el('rules-apply').disabled=true;try{const result=await call('run',previewToken);previewToken=undefined;text('p',`${result.done} action(s) applied; ${result.failed} failed/unknown. See Action History for details.`,el('preview'));el('rules-apply').hidden=true;await refresh();}catch(error){text('p',error.message,el('preview'));}finally{el('rules-apply').disabled=false;}};
 return {async open(){try{options();await list();if(!el('rules').open)el('rules').showModal();}catch(error){notice(error.message);}}};
}

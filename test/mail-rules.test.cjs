const {test}=require('node:test');const assert=require('node:assert/strict');
const {createMailRules,normalizeRule}=require('../apps/desktop/mail-rules.cjs');
function memory(data=[]){return {list:async()=>structuredClone(data),update:async fn=>{data=fn(structuredClone(data));}};}
const rule={name:'Invoices',accountId:'a',match:'all',enabled:true,stopProcessing:true,conditions:[{field:'subject',operator:'contains',value:'invoice'}],exceptions:[],actions:[{type:'trash'}]};
const message=uid=>({id:'a:'+uid,accountId:'a',path:'INBOX',uid,validity:'1',subject:'Invoice',email:'sender@example.com'});
test('saved rules survive service recreation and initial receive creates a non-retroactive baseline',async()=>{
 const store=memory(),cursors=memory(),calls=[];const opts={vault:memory([{id:'a'}]),store,cursors,actions:{apply:async(ref,key)=>{calls.push({ref,key});return {status:'done'};}}};
 let service=createMailRules(opts);await service.save(rule);service=createMailRules(opts);assert.equal((await service.list())[0].name,'Invoices');
 await service.processIncoming({id:'a'},{messages:[message(10)],validity:'1',before:null});assert.equal(calls.length,0);
 await service.processIncoming({id:'a'},{messages:[message(11),message(10)],validity:'1',before:null});assert.equal(calls.length,1);assert.equal(calls[0].ref.uid,11);
 await service.processIncoming({id:'a'},{messages:[message(11)],validity:'1',before:null});assert.equal(calls.length,1);
});
test('manual rule execution needs a current single-use preview and revalidates the rule version',async()=>{
 const calls=[];const service=createMailRules({vault:memory([{id:'a'}]),store:memory(),cursors:memory(),fetch:async()=>({messages:[message(1)],validity:'1'}),actions:{apply:async()=>{calls.push(1);return {status:'done'};}}});
 const {id}=await service.save(rule),p=await service.preview('a');await service.save({...rule,id,name:'Changed'});await assert.rejects(service.run(p.token));assert.equal(calls.length,0);
 const next=await service.preview('a');assert.equal(next.matches.length,1);assert.equal((await service.run(next.token)).done,1);await assert.rejects(service.run(next.token));
});
test('unsupported permanent deletion/auto-reply cannot enter the live rule executor',()=>{
 for(const type of ['deletePermanently','autoReply'])assert.throws(()=>normalizeRule({...rule,actions:[{type,value:'anything'}]}));
});
test('new-mail rules catch up beyond the most recent page and preserve account scope',async()=>{
 const store=memory(),cursors=memory([{id:'a',validity:'1',highest:1}]),calls=[];
 const service=createMailRules({vault:memory([{id:'a'}]),store,cursors,fetch:async()=>({messages:[message(2)],before:null,validity:'1'}),actions:{apply:async r=>{calls.push(r.uid);return {status:'done'};}}});
 await service.save(rule);await service.processIncoming({id:'a'},{messages:[message(3)],before:2,validity:'1'});assert.deepEqual(calls,[2,3]);
});

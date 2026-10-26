const {test}=require('node:test');
const assert=require('node:assert/strict');
const {registerMessageMenuState}=require('../apps/desktop/message-menu.cjs');
test('native Message menu rejects foreign frames and follows selection, Junk and read-only capability',()=>{
 let listener;const contents={mainFrame:{url:'mademail://app/'}};
 const items=Object.fromEntries(['reply','replyAll','forward','archive','trash','junk','notJunk','unread','flag'].map(a=>['message:'+a,{}]));
 registerMessageMenuState({on:(channel,callback)=>{assert.equal(channel,'message:menu-state');listener=callback;}},{getApplicationMenu:()=>({getMenuItemById:id=>items[id]})},()=>({webContents:contents}));
 const state={selected:true,canModify:true,junk:true,unread:true,flagged:true,trash:false,archive:false};
 listener({sender:{},senderFrame:contents.mainFrame},state);assert.deepEqual(items['message:junk'],{});
 const event={sender:contents,senderFrame:contents.mainFrame};listener(event,state);
 assert.equal(items['message:junk'].visible,false);assert.equal(items['message:notJunk'].enabled,true);assert.equal(items['message:unread'].label,'Mark as Read');assert.equal(items['message:flag'].label,'Remove Flag');assert.equal(items['message:replyAll'].enabled,false);
 listener(event,{...state,canModify:false});assert.ok(Object.values(items).every(i=>!i.enabled));
 listener(event,{...state,selected:false});assert.ok(Object.values(items).every(i=>!i.enabled));
});

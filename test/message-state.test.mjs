import {test} from 'node:test';import assert from 'node:assert/strict';
import {reconcileMessage,patchMessageFlags} from '../packages/core/message-state.mjs';
test('stale refresh flags cannot undo a confirmed Read/Flag action, and cached body survives',()=>{
 const previous={id:'a:INBOX:1:5',body:'Synthetic loaded body',loaded:true,hasAttachment:true,attachments:[{index:0,filename:'invoice.txt',size:17}]},fresh={id:previous.id,body:'Select to load',unread:true,flagged:false};
 const result=reconcileMessage(fresh,previous,{unread:false,flagged:true});assert.equal(result.message.unread,false);assert.equal(result.message.flagged,true);assert.equal(result.message.body,previous.body);assert.deepEqual(result.message.attachments,previous.attachments);assert.equal(result.message.hasAttachment,true);assert.deepEqual(result.pending,{unread:false,flagged:true});
 const acknowledged=reconcileMessage({...fresh,unread:false,flagged:true},previous,result.pending);assert.deepEqual(acknowledged.pending,{});
 assert.equal(reconcileMessage({...fresh,unread:true},previous,acknowledged.pending).message.unread,true,'later changes from another client are accepted after server acknowledgment');
});
test('Read completion updates the current message object after refresh replaces the old object',()=>{
 const old={id:'a:INBOX:1:5',unread:true},messages=[{...old},{id:'b:INBOX:1:5',unread:true}];
 const updated=patchMessageFlags(messages,old.id,{unread:false});assert.equal(updated[0].unread,false);assert.equal(updated[1].unread,true);assert.equal(messages[0].unread,true);
});

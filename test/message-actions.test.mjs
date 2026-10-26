import {test} from 'node:test';
import assert from 'node:assert/strict';
import {messageCommands,applyDemoMessageAction} from '../packages/core/message-actions.mjs';
test('message actions reflect junk/read/flag state and capabilities',()=>{
 const inbox={id:'one',accountId:'personal',folder:'inbox',unread:true,flagged:false};
 assert.equal(messageCommands(inbox,{canModify:true}).junk.visible,true);
 assert.equal(messageCommands(inbox,{canModify:true}).notJunk.visible,false);
 assert.equal(messageCommands({...inbox,folder:'spam'},{canModify:true}).notJunk.visible,true);
 assert.equal(messageCommands(inbox,{canModify:true}).unread.label,'Mark as Read');
 for(const command of Object.values(messageCommands(inbox)))assert.equal(command.enabled,false);
 for(const command of Object.values(messageCommands(null,{canModify:true})))assert.equal(command.enabled,false);
 assert.equal(messageCommands(inbox,{canModify:true}).replyAll.enabled,false);
});
test('Junk/Not Junk moves preserve account and Delete never permanently removes a message',()=>{
 const original={id:'one',accountId:'personal',folder:'inbox',unread:true};
 const junk=applyDemoMessageAction(original,'junk');assert.equal(junk.folder,'junk');assert.equal(original.folder,'inbox');
 const restored=applyDemoMessageAction(junk,'notJunk');assert.equal(restored.folder,'inbox');assert.equal(restored.accountId,'personal');
 const deleted=applyDemoMessageAction(original,'trash');assert.equal(deleted.folder,'trash');assert.equal(deleted.id,'one');
 assert.throws(()=>applyDemoMessageAction(deleted,'trash'));
 assert.throws(()=>applyDemoMessageAction(original,'notJunk'));
 assert.throws(()=>applyDemoMessageAction(original,'replyAll'));
});

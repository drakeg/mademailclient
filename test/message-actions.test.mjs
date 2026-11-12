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
test('pending Delete shows progress instead of unavailable and rejects duplicate changes',()=>{
 const message={id:'one',folder:'inbox'};
 const commands=messageCommands(message,{canModify:true,busy:true,pendingAction:'trash'});
 assert.equal(commands.trash.enabled,false);assert.equal(commands.trash.label,'Deleting…');assert.match(commands.trash.reason,/Moving.*Deleted Items/);assert.doesNotMatch(commands.trash.reason,/unavailable/i);assert.equal(commands.junk.enabled,false);
 assert.equal(messageCommands(message,{canModify:true}).trash.enabled,true,'Delete is restored after completion');
});
test('disabled Delete explains Trash and read-only cases specifically',()=>{
 assert.match(messageCommands({folder:'trash'},{canModify:true}).trash.reason,/already in Deleted Items/i);
 assert.match(messageCommands({folder:'inbox'},{canModify:false}).trash.reason,/read-only/i);
 assert.match(messageCommands(null,{canModify:true}).trash.reason,/Select a message/i);
});

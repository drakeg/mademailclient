import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replyDraft,canSendAccount} from '../apps/web/composer.mjs';
const own={id:'a',email:'me@example.com',smtp:{}};
const m={accountId:'a',email:'sender@example.com',replyTo:['reply@example.com'],toAddresses:['me@example.com','other@example.com'],ccAddresses:['OTHER@example.com','team@example.com'],subject:'Topic',body:'Hello',time:'Today',from:'Fixture',messageId:'<fixture@example.com>'};
test('reply-all honors Reply-To, removes self and deduplicates case-insensitively',()=>{
 const d=replyDraft('replyAll',m,own);assert.deepEqual(d.to,['reply@example.com']);assert.deepEqual(d.cc,['OTHER@example.com','team@example.com']);assert.equal(d.accountId,'a');assert.equal(d.inReplyTo,m.messageId);
 const sent=replyDraft('reply',{...m,email:'me@example.com'},own);assert.deepEqual(sent.to,['other@example.com']);
 const forward=replyDraft('forward',m,own);assert.equal(forward.to,undefined);assert.equal(forward.inReplyTo,undefined);assert.match(forward.text,/> Hello/);
 assert.equal(canSendAccount({...own,authType:'oauth2',provider:'yahoo'}),false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { emptyMailbox } from '../packages/core/mailboxes.mjs';
const { validMailboxRequest }=createRequire(import.meta.url)('../apps/desktop/mailbox-ipc.cjs');
test('empty Junk preserves inboxes and Deleted Items without mutating the input',()=>{
 const mail=[{id:'1',folder:'junk',accountId:'work'},{id:'2',folder:'junk',accountId:'personal'},{id:'3',folder:'trash'},{id:'4',folder:'inbox'}];
 assert.deepEqual(emptyMailbox(mail,'junk').map(m=>m.id),['3','4']);assert.equal(mail.length,4);
 assert.deepEqual(emptyMailbox(mail,'trash').map(m=>m.id),['1','2','4']);
 assert.throws(()=>emptyMailbox(mail,'inbox'));assert.throws(()=>emptyMailbox(mail,'all'));
});
test('native mailbox bridge rejects foreign windows, frames, origins and mailbox names',()=>{
 const frame={url:'mademail://app/'};const contents={mainFrame:frame};const event={sender:contents,senderFrame:frame};
 assert.equal(validMailboxRequest(event,contents,'junk'),true);
 assert.equal(validMailboxRequest(event,contents,'trash'),true);
 assert.equal(validMailboxRequest(event,contents,'inbox'),false);
 assert.equal(validMailboxRequest({...event,sender:{}},contents,'junk'),false);
 assert.equal(validMailboxRequest({...event,senderFrame:{url:'mademail://app/'}},contents,'junk'),false);
 frame.url='https://example.com';assert.equal(validMailboxRequest(event,contents,'junk'),false);
});

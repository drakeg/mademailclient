const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fetchFolder,listFolders}=require('../apps/desktop/accounts.cjs');
const account={id:'fixture',email:'me@example.com',host:'imap.example.com',username:'me',password:'fixture'};
const resolve=async()=>[{address:'8.8.8.8'}];
let opened,ranges=[],released=0;
class Client {
 constructor(){this.mailbox={exists:120,uidValidity:42};}
 on(){} async connect(){} async logout(){}
 async getMailboxLock(path,options){opened={path,options};return {release(){released++;}};}
 async list(){return [{path:'INBOX',name:'Inbox',flags:new Set()},{path:'Projects:2026',name:'Projects',flags:new Set()},{path:'Container',flags:new Set(['\\Noselect'])}];}
 async *fetch(range){ranges.push(range);yield {uid:11,envelope:{subject:'fixture',to:[{address:'me@example.com'}]},flags:new Set()};}
}
test('real folders preserve server paths and pagination locks the requested mailbox read-only',async()=>{
 const deps={Client,resolve};
 const folders=await listFolders(account,deps);assert.equal(folders.length,2);assert.equal(folders[1].path,'Projects:2026');assert.ok(!folders[1].key.includes(':'));
 const first=await fetchFolder(account,{path:'Projects:2026'},deps);assert.equal(first.before,71);assert.equal(ranges.at(-1),'71:120');assert.deepEqual(opened,{path:'Projects:2026',options:{readOnly:true}});assert.equal(first.messages[0].path,'Projects:2026');
 await fetchFolder(account,{path:'Projects:2026',before:first.before,validity:first.validity},deps);assert.equal(ranges.at(-1),'21:70');
 await assert.rejects(fetchFolder(account,{validity:'old'},deps));assert.equal(released,3);
 await assert.rejects(fetchFolder(account,{path:'INBOX\r\nBAD'},deps));
});

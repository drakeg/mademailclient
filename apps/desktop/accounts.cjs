// Secrets stay in the main process. The renderer receives public account summaries only.
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { isIP, BlockList } = require('node:net');
const { lookup } = require('node:dns/promises');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const blocked = new BlockList();
for (const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['100.64.0.0',10],['192.0.0.0',24],['198.18.0.0',15],['192.0.2.0',24],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]]) blocked.addSubnet(address,prefix,'ipv4');
function publicAddress(address) {
 // IPv6 is deliberately restricted to global unicast, excluding mapped IPv4.
 return isIP(address)===4 ? !blocked.check(address,'ipv4') : isIP(address)===6 && /^[23][0-9a-f]{3}:/i.test(address) && !address.toLowerCase().startsWith('2001:db8:');
}
function validateAccount(value) {
 if (!value || typeof value!=='object') throw new Error('Invalid account');
 const result={};
 for(const [key,max] of [['email',254],['host',253],['username',254],['password',1024]]) {
  if(typeof value[key]!=='string'||!value[key].length||value[key].length>max||/[\r\n\0]/.test(value[key]))throw new Error('Check all account fields');
  result[key]=key==='password'?value[key]:value[key].trim();
 }
 result.host=result.host.toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)||! /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(result.host)||result.host.endsWith('.local')||result.host.endsWith('.localhost'))throw new Error('Use an email address and public IMAP hostname');
 return result;
}
const summary=a=>({id:a.id,email:a.email,host:a.host,username:a.username});
function createVault(path,crypto) {
 let queue=Promise.resolve();
 async function read(){try {const decrypted=await crypto.decryptStringAsync(await fs.readFile(path));const data=JSON.parse(decrypted.result);if(data.version!==1||!Array.isArray(data.accounts))throw new Error('Invalid vault');return data.accounts;}catch(error){if(error.code==='ENOENT')return [];throw new Error('Account storage could not be unlocked. Existing data was preserved.');}}
 return {async list(){await queue;return read();},update(change){const task=queue.then(async()=>{if(!await crypto.isAsyncEncryptionAvailable())throw new Error('OS credential encryption is unavailable');const accounts=await read();const next=change(accounts);const encrypted=await crypto.encryptStringAsync(JSON.stringify({version:1,accounts:next}));const temp=path+'.'+randomUUID();try{await fs.writeFile(temp,encrypted,{mode:0o600,flag:'wx'});await fs.rename(temp,path);}finally{await fs.rm(temp,{force:true});}return next;});queue=task.catch(()=>{});return task;}};
}
async function withInbox(account,run,{resolve=lookup,Client=ImapFlow}={}) {
 const addresses=await resolve(account.host,{all:true});
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('Use a public mail server');
 const client=new Client({host:addresses[0].address,port:993,secure:true,tls:{servername:account.host,rejectUnauthorized:true,minVersion:'TLSv1.2'},auth:{user:account.username,pass:account.password},logger:false,disableAutoIdle:true,disableCompression:true,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});
 client.on('error',()=>{});
 try {await client.connect();const lock=await client.getMailboxLock('INBOX',{readOnly:true});try{return await run(client);}finally{lock.release();}}finally{await client.logout().catch(()=>client.close());}
}
async function fetchInbox(account) {
 return withInbox(account,async client=>{
  const total=client.mailbox.exists;if(!total)return [];
  const validity=String(client.mailbox.uidValidity);const results=[];
  for await(const m of client.fetch(`${Math.max(1,total-29)}:*`,{uid:true,envelope:true,flags:true,size:true})){
   const e=m.envelope||{},from=e.from?.[0]||{};
   results.push({id:`${account.id}:${validity}:${m.uid}`,accountId:account.id,uid:m.uid,validity,from:String(from.name||from.address||'Unknown sender').slice(0,500),email:String(from.address||''),to:account.email,subject:String(e.subject||'(No subject)').slice(0,1000),body:'Select to load message text.',size:m.size,unread:!m.flags.has('\\Seen'),flagged:m.flags.has('\\Flagged'),folder:'inbox',receivedAt:e.date?new Date(e.date).toISOString():null,time:e.date?new Date(e.date).toLocaleString():'',date:'Recent messages'});
  }return results.reverse();
 });
}
function registerAccounts(ipcMain,getWindow,vault) {
 let busy=false;
 let lastAdd=0;
 const handlers={
  list:async()=> (await vault.list()).map(summary),
  add:async input=>{if(Date.now()-lastAdd<5000)throw new Error('Wait before trying again');lastAdd=Date.now();const account=validateAccount(input);await withInbox(account,async()=>{});account.id=randomUUID();await vault.update(all=>{if(all.some(a=>a.host===account.host&&a.username===account.username))throw new Error('Account already added');return [...all,account];});return summary(account);},
  remove:async id=>{if(typeof id!=='string')throw new Error('Invalid account');await vault.update(all=>all.filter(a=>a.id!==id));return null;},
  inbox:async id=>{const a=(await vault.list()).find(a=>a.id===id);if(!a)throw new Error('Account not found');return fetchInbox(a);},
  body:async input=>{if(!input||!Number.isSafeInteger(input.uid)||input.uid<1||typeof input.validity!=='string')throw new Error('Invalid message');const a=(await vault.list()).find(a=>a.id===input.accountId);if(!a)throw new Error('Account not found');return withInbox(a,async c=>{if(String(c.mailbox.uidValidity)!==input.validity)throw new Error('Refresh the inbox');const meta=await c.fetchOne(input.uid,{size:true},{uid:true});if(!meta||meta.size>2*1024*1024)return 'This message exceeds the 2 MB text preview limit.';const mail=await c.fetchOne(input.uid,{source:{start:0,maxLength:2*1024*1024}},{uid:true});const parsed=await simpleParser(mail.source,{skipHtmlToText:false,skipTextToHtml:true,skipImageLinks:true});return String(parsed.text||'No plain text content available.').slice(0,200000);});}
 };
 for(const [name,handler]of Object.entries(handlers))ipcMain.handle(`accounts:${name}`,async(event,input)=>{
  const contents=getWindow()?.webContents;
  if(!contents||event.sender!==contents||event.senderFrame!==contents.mainFrame||event.senderFrame.url!=='mademail://app/')return {ok:false,error:'Unauthorized request'};
  if(busy)return {ok:false,error:'Another account operation is in progress. Please try again.'};busy=true;
  try{return {ok:true,data:await handler(input)};}catch{return {ok:false,error:'Account operation failed. Check the server, app password, network, and OS credential storage. Existing accounts were preserved.'};}finally{busy=false;}
 });
}
module.exports={validateAccount,publicAddress,createVault,registerAccounts,withInbox};

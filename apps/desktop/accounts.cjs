// Secrets stay in the main process. The renderer receives public account summaries only.
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { publicAddress, publicHost, field, emailAddress, endpoint } = require('./mail-network.cjs');
const { verifySmtp } = require('./smtp.cjs');
const { discoverAccount } = require('./account-discovery.cjs');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
function validateAccount(value) {
 if(!value||typeof value!=='object')throw new Error('Invalid account');
 const account={email:emailAddress(value.email),...endpoint(value,'imap'),username:field(value.username,'username'),password:field(value.password,'password',1024)};
 if(value.smtp!==undefined){
  const smtp=value.smtp;
  if(!smtp||typeof smtp!=='object'||typeof smtp.useIncomingAuth!=='boolean')throw new Error('Check SMTP settings');
  account.smtp={...endpoint(smtp,'smtp'),useIncomingAuth:smtp.useIncomingAuth,
   username:smtp.useIncomingAuth?account.username:field(smtp.username,'SMTP username'),
   password:smtp.useIncomingAuth?account.password:field(smtp.password,'SMTP password',1024)};
 }
 return account;
}
function accountSummary(a) {
 return {id:a.id,email:a.email,host:a.host,port:a.port??993,security:a.security??'tls',username:a.username,
  ...(a.smtp?{smtp:{host:a.smtp.host,port:a.smtp.port,security:a.smtp.security,username:a.smtp.username,useIncomingAuth:a.smtp.useIncomingAuth}}:{})};
}
function createVault(path,crypto) {
 let queue=Promise.resolve();
 async function read(){try {const decrypted=await crypto.decryptStringAsync(await fs.readFile(path));const data=JSON.parse(decrypted.result);if(data.version!==1||!Array.isArray(data.accounts))throw new Error('Invalid vault');return data.accounts;}catch(error){if(error.code==='ENOENT')return [];throw new Error('Account storage could not be unlocked. Existing data was preserved.');}}
 return {async list(){await queue;return read();},update(change){const task=queue.then(async()=>{if(!await crypto.isAsyncEncryptionAvailable())throw new Error('OS credential encryption is unavailable');const accounts=await read();const next=change(accounts);const encrypted=await crypto.encryptStringAsync(JSON.stringify({version:1,accounts:next}));const temp=path+'.'+randomUUID();try{await fs.writeFile(temp,encrypted,{mode:0o600,flag:'wx'});await fs.rename(temp,path);}finally{await fs.rm(temp,{force:true});}return next;});queue=task.catch(()=>{});return task;}};
}
async function withInbox(account,run,{resolve,Client=ImapFlow}={}) {
 const address=await publicHost(account.host,resolve);
 const client=new Client({host:address,port:account.port??993,secure:(account.security??'tls')==='tls',doSTARTTLS:account.security==='starttls',tls:{servername:account.host,rejectUnauthorized:true,minVersion:'TLSv1.2'},auth:{user:account.username,pass:account.password},logger:false,disableAutoIdle:true,disableCompression:true,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});
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
function setupError(code,message) {return Object.assign(new Error(message),{publicCode:code,publicMessage:message});}
function sameLogin(next,previous,protocol) {
 if(!previous)return false;
 const a=endpoint(next,protocol),b=endpoint(previous,protocol);
 return a.host===b.host&&a.port===b.port&&a.security===b.security&&next.username===previous.username;
}
function editedAccount(input,previous) {
 const value={...input};
 if(previous&&value.password==='') {
  if(!sameLogin(value,previous,'imap'))throw new Error('Re-enter incoming password after changing its server or username');
  value.password=previous.password;
 }
 if(value.smtp!==undefined){
  value.smtp={...value.smtp};
  if(previous?.smtp&&value.smtp.useIncomingAuth&&input.password===''&&!sameLogin({...value.smtp,username:value.username},previous.smtp,'smtp'))throw new Error('Re-enter password after changing outgoing server or username');
  if(!value.smtp.useIncomingAuth&&value.smtp.password===''){
   if(!sameLogin(value.smtp,previous?.smtp,'smtp'))throw new Error('Re-enter SMTP password after changing its server or username');
   value.smtp.password=previous.smtp.password;
  }
 } else if(previous?.smtp)value.smtp={...previous.smtp};
 return validateAccount(value);
}
function registerAccounts(ipcMain,getWindow,vault,{testInbox=a=>withInbox(a,async()=>{}),testSmtp=verifySmtp,discover=discoverAccount,now=Date.now}={}) {
 let busy=false,discovering=false;
 let lastAdd=0;
 async function save(input,id) {
  if(!input||typeof input!=='object')throw setupError('SETTINGS_INVALID','Check the account settings.');
  const all=await vault.list(),previous=id?all.find(a=>a.id===id):undefined;
  if(id&&!previous)throw setupError('ACCOUNT_NOT_FOUND','Account no longer exists. Reopen Accounts.');
  let account;
  try{account=editedAccount(input,previous);}catch{throw setupError('SETTINGS_INVALID','Check required fields, TLS ports and passwords. Re-enter passwords when changing a server or username.');}
  if(all.some(a=>a.id!==id&&a.host===account.host&&a.username===account.username))throw setupError('DUPLICATE_ACCOUNT','This incoming account is already added.');
  if(now()-lastAdd<5000)throw setupError('RETRY_LATER','Wait five seconds before testing these settings again.');lastAdd=now();
  try{await testInbox(account);}catch{throw setupError('IMAP_CHECK_FAILED','Incoming IMAP connection failed. Check the incoming server, app password, TLS settings and provider policy.');}
  if(account.smtp)try{await testSmtp(account.smtp);}catch{throw setupError('SMTP_CHECK_FAILED','Outgoing SMTP connection failed. Check the outgoing server, app password, TLS settings and provider policy. No settings were saved.');}
  account.id=id||randomUUID();
  await vault.update(current=>{
   if(id&&!current.some(a=>a.id===id))throw new Error('Account was removed');
   if(current.some(a=>a.id!==id&&a.host===account.host&&a.username===account.username))throw new Error('Duplicate account');
   return id?current.map(a=>a.id===id?account:a):[...current,account];
  });
  return accountSummary(account);
 }
 const handlers={
  list:async()=> (await vault.list()).map(accountSummary),
  discover:async email=>discover(email),
  add:async input=>save(input),
  update:async input=>{if(!input||typeof input.id!=='string'||!input.id)throw setupError('SETTINGS_INVALID','Select an account to edit.');return save(input,input.id);},
  remove:async id=>{if(typeof id!=='string')throw new Error('Invalid account');await vault.update(all=>all.filter(a=>a.id!==id));return null;},
  inbox:async id=>{const a=(await vault.list()).find(a=>a.id===id);if(!a)throw new Error('Account not found');return fetchInbox(a);},
  body:async input=>{if(!input||!Number.isSafeInteger(input.uid)||input.uid<1||typeof input.validity!=='string')throw new Error('Invalid message');const a=(await vault.list()).find(a=>a.id===input.accountId);if(!a)throw new Error('Account not found');return withInbox(a,async c=>{if(String(c.mailbox.uidValidity)!==input.validity)throw new Error('Refresh the inbox');const meta=await c.fetchOne(input.uid,{size:true},{uid:true});if(!meta||meta.size>2*1024*1024)return 'This message exceeds the 2 MB text preview limit.';const mail=await c.fetchOne(input.uid,{source:{start:0,maxLength:2*1024*1024}},{uid:true});const parsed=await simpleParser(mail.source,{skipHtmlToText:false,skipTextToHtml:true,skipImageLinks:true});return String(parsed.text||'No plain text content available.').slice(0,200000);});}
 };
 for(const [name,handler]of Object.entries(handlers))ipcMain.handle(`accounts:${name}`,async(event,input)=>{
  const contents=getWindow()?.webContents;
  if(!contents||event.sender!==contents||event.senderFrame!==contents.mainFrame||event.senderFrame.url!=='mademail://app/')return {ok:false,error:'Unauthorized request'};
  const discovery=name==='discover';
  if(discovery?discovering:busy)return {ok:false,error:'Another account operation is in progress. Please try again.'};if(discovery)discovering=true;else busy=true;
  try{return {ok:true,data:await handler(input)};}catch(error){return {ok:false,code:error.publicCode||'ACCOUNT_OPERATION_FAILED',error:error.publicMessage||'Account operation failed. Check the network and OS credential storage. Existing accounts were preserved.'};}finally{if(discovery)discovering=false;else busy=false;}
 });
}
module.exports={validateAccount,publicAddress,createVault,registerAccounts,withInbox,accountSummary};

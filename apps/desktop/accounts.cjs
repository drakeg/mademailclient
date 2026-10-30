// Secrets stay in the main process. The renderer receives public account summaries only.
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { publicAddress, publicHost, field, emailAddress, endpoint } = require('./mail-network.cjs');
const { verifySmtp } = require('./smtp.cjs');
const { discoverAccount } = require('./account-discovery.cjs');
const { assertProviderHosts } = require('./oauth-providers.cjs');
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
 return {id:a.id,authType:a.oauth?'oauth2':'password',...(a.oauth?{provider:a.oauth.provider}:{}),email:a.email,host:a.host,port:a.port??993,security:a.security??'tls',username:a.username,
  ...(a.smtp?{smtp:{host:a.smtp.host,port:a.smtp.port,security:a.smtp.security,username:a.smtp.username,useIncomingAuth:a.smtp.useIncomingAuth}}:{})};
}
function createVault(path,crypto) {
 let queue=Promise.resolve();
 async function read(){try {const decrypted=await crypto.decryptStringAsync(await fs.readFile(path));const data=JSON.parse(decrypted.result);if(data.version!==1||!Array.isArray(data.accounts))throw new Error('Invalid vault');return data.accounts;}catch(error){if(error.code==='ENOENT')return [];throw new Error('Account storage could not be unlocked. Existing data was preserved.');}}
 return {available:()=>crypto.isAsyncEncryptionAvailable(),async list(){await queue;return read();},update(change){const task=queue.then(async()=>{if(!await crypto.isAsyncEncryptionAvailable())throw new Error('OS credential encryption is unavailable');const accounts=await read();const next=change(accounts);const encrypted=await crypto.encryptStringAsync(JSON.stringify({version:1,accounts:next}));const temp=path+'.'+randomUUID();try{await fs.writeFile(temp,encrypted,{mode:0o600,flag:'wx'});await fs.rename(temp,path);}finally{await fs.rm(temp,{force:true});}return next;});queue=task.catch(()=>{});return task;}};
}
async function withConnection(account,run,{resolve,Client=ImapFlow}={}) {
 if(account.oauth)assertProviderHosts(account);
 const address=await publicHost(account.host,resolve);
 const client=new Client({host:address,port:account.port??993,secure:(account.security??'tls')==='tls',doSTARTTLS:account.security==='starttls',tls:{servername:account.host,rejectUnauthorized:true,minVersion:'TLSv1.2'},auth:account.oauth?{user:account.username,accessToken:account.oauth.accessToken}:{user:account.username,pass:account.password},logger:false,disableAutoIdle:true,disableCompression:true,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});
 client.on('error',()=>{});
 try {await client.connect();return await run(client);}finally{await client.logout().catch(()=>client.close());}
}
async function withMailbox(account,path,run,options={}) {
 return withConnection(account,async client=>{const lock=await client.getMailboxLock(field(path,'folder',1024),{readOnly:true});try{return await run(client);}finally{lock.release();}},options);
}
async function withInbox(account,run,options={}) {return withMailbox(account,'INBOX',run,options);}
const folderKey=path=>path.toUpperCase()==='INBOX'?'inbox':'folder-'+encodeURIComponent(path);
async function listFolders(account,options={}) {
 return withConnection(account,async c=>(await c.list()).filter(f=>!f.flags?.has('\\Noselect')).slice(0,1000).map(f=>({path:f.path,name:f.name,key:folderKey(f.path),specialUse:f.specialUse||null})),options);
}
async function fetchFolder(account,input={},options={}) {
 const path=field(input.path||'INBOX','folder',1024);
 if(input.before!==undefined&&(!Number.isSafeInteger(input.before)||input.before<1))throw new Error('Invalid page');
 return withMailbox(account,path,async client=>{
  const total=client.mailbox.exists,validity=String(client.mailbox.uidValidity);
  if(input.validity!==undefined&&input.validity!==validity)throw new Error('Mailbox changed. Refresh before loading older mail.');
  const end=Math.min(total,input.before===undefined?total:input.before-1),start=Math.max(1,end-49),results=[];
  if(end>0)for await(const m of client.fetch(`${start}:${end}`,{uid:true,envelope:true,flags:true,size:true})){
   const e=m.envelope||{},from=e.from?.[0]||{};
   const addresses=items=>(items||[]).map(x=>String(x.address||'')).filter(Boolean).slice(0,100);
   results.push({id:`${account.id}:${encodeURIComponent(path)}:${validity}:${m.uid}`,accountId:account.id,path,uid:m.uid,validity,from:String(from.name||from.address||'Unknown sender').slice(0,500),email:String(from.address||''),to:addresses(e.to).join(', '),toAddresses:addresses(e.to),ccAddresses:addresses(e.cc),replyTo:addresses(e.replyTo),messageId:e.messageId||'',subject:String(e.subject||'(No subject)').slice(0,1000),body:'Select to load message text.',size:m.size,unread:!m.flags.has('\\Seen'),flagged:m.flags.has('\\Flagged'),folder:folderKey(path),receivedAt:e.date?new Date(e.date).toISOString():null,time:e.date?new Date(e.date).toLocaleString():'',date:'Recent messages'});
  }
  return {messages:results.reverse(),before:start>1?start:null,validity,total};
 },options);
}
async function fetchInbox(account){return (await fetchFolder(account)).messages;}
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
function createOperationQueue(concurrency=3,capacity=100){
 let active=0;const pending=[];
 function drain(){while(active<concurrency&&pending.length){const job=pending.shift();active++;Promise.resolve().then(job.run).then(job.resolve,job.reject).finally(()=>{active--;drain();});}}
 return (run,priority=0)=>new Promise((resolve,reject)=>{
  if(active+pending.length>=capacity){reject(setupError('ACCOUNT_QUEUE_FULL','Too many pending account requests. Wait for the current requests to finish.'));return;}
  const job={run,resolve,reject,priority},at=pending.findIndex(item=>item.priority<priority);
  if(at<0)pending.push(job);else pending.splice(at,0,job);drain();
 });
}
async function fetchMessageBody(account,input){
 return withMailbox(account,input.path||'INBOX',async c=>{
  if(String(c.mailbox.uidValidity)!==input.validity)throw setupError('STALE_MESSAGE','Mailbox identity changed. Refresh this folder.');
  const meta=await c.fetchOne(input.uid,{size:true},{uid:true});
  if(!meta)throw setupError('MESSAGE_GONE','This message moved or was deleted. Refresh this folder.');
  if(meta.size>2*1024*1024)return 'This message exceeds the 2 MB text preview limit.';
  const mail=await c.fetchOne(input.uid,{source:{start:0,maxLength:2*1024*1024}},{uid:true});
  if(!mail?.source)throw setupError('MESSAGE_GONE','This message moved or was deleted. Refresh this folder.');
  const parsed=await simpleParser(mail.source,{skipHtmlToText:false,skipTextToHtml:true,skipImageLinks:true});
  return String(parsed.text||'No plain text content available.').slice(0,200000);
 });
}
function registerAccounts(ipcMain,getWindow,vault,{testInbox=a=>withInbox(a,async()=>{}),testSmtp=verifySmtp,discover=discoverAccount,now=Date.now,resolveAccount=async a=>a,onInbox=async()=>false,readBody=fetchMessageBody}={}) {
 const reads=createOperationQueue(3),settings=createOperationQueue(1),discovery=createOperationQueue(2);
 let lastAdd=0;
 async function save(input,id) {
  if(!input||typeof input!=='object')throw setupError('SETTINGS_INVALID','Check the account settings.');
  const all=await vault.list(),previous=id?all.find(a=>a.id===id):undefined;
  if(id&&!previous)throw setupError('ACCOUNT_NOT_FOUND','Account no longer exists. Reopen Accounts.');
  if(previous?.oauth)throw setupError('OAUTH_ACCOUNT','Use Reconnect for a browser-authorized account.');
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
  folders:async id=>{const a=(await vault.list()).find(a=>a.id===id);if(!a)throw new Error('Account not found');return listFolders(await resolveAccount(a));},
  folder:async input=>{if(!input||typeof input.accountId!=='string')throw new Error('Select an account');const a=(await vault.list()).find(a=>a.id===input.accountId);if(!a)throw new Error('Account not found');const prepared=await resolveAccount(a),page=await fetchFolder(prepared,input);if((input.path||'INBOX').toUpperCase()==='INBOX'&&input.before===undefined){try{if(await onInbox(prepared,page))return fetchFolder(prepared,input);}catch(e){page.ruleError=e.publicMessage||'Automatic rules could not complete. Review Action History.';}}return page;},
  inbox:async id=>{const a=(await vault.list()).find(a=>a.id===id);if(!a)throw new Error('Account not found');return fetchInbox(await resolveAccount(a));},
  body:async input=>{if(!input||!Number.isSafeInteger(input.uid)||input.uid<1||typeof input.validity!=='string')throw new Error('Invalid message');const a=(await vault.list()).find(a=>a.id===input.accountId);if(!a)throw new Error('Account not found');return readBody(await resolveAccount(a),input); }
 };
 for(const [name,handler]of Object.entries(handlers))ipcMain.handle(`accounts:${name}`,async(event,input)=>{
  const contents=getWindow()?.webContents;
  if(!contents||event.sender!==contents||event.senderFrame!==contents.mainFrame||event.senderFrame.url!=='mademail://app/')return {ok:false,error:'Unauthorized request'};
  const enqueue=name==='discover'?discovery:['add','update','remove'].includes(name)?settings:reads;
  try{return {ok:true,data:await enqueue(()=>{const active=getWindow()?.webContents;if(!active||event.sender!==active||event.senderFrame!==active.mainFrame||event.senderFrame.url!=='mademail://app/')throw setupError('REQUEST_CANCELLED','The requesting window closed. Reopen the account or message.');return handler(input);},name==='body'?1:0)};}catch(error){return {ok:false,code:error.publicCode||'ACCOUNT_OPERATION_FAILED',error:error.publicMessage||'Account operation failed. Check the network and OS credential storage. Existing accounts were preserved.'};}
 });
}
module.exports={validateAccount,publicAddress,createVault,registerAccounts,createOperationQueue,withInbox,withConnection,withMailbox,listFolders,fetchFolder,accountSummary};

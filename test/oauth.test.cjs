const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createAuthorizationAttempt}=require('../apps/desktop/oauth-flow.cjs');
const {providerStatus,providerAccount}=require('../apps/desktop/oauth-providers.cjs');
test('unregistered providers are explicitly unavailable; public summaries have no credentials',()=>{
 const status=providerStatus({});assert.equal(status.length,2);assert.ok(status.every(p=>!p.available));assert.ok(status.every(p=>p.reason.includes('registration')));
 const google=providerStatus({google:{clientId:'test.apps.googleusercontent.com'}}).find(p=>p.id==='google');assert.equal(google.available,true);assert.equal(Object.hasOwn(google,'clientId'),false);
});
test('PKCE flow uses fresh state, correct challenge and exact one-use custom callback',async()=>{
 const a=await createAuthorizationAttempt('yahoo','synthetic-client');
 try{
  const url=new URL(a.url);assert.equal(url.origin,'https://api.login.yahoo.com');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('redirect_uri'),'com.mademailclient.auth://yahoo/callback');
  assert.equal(a.acceptCallback('https://evil.example/callback?code=wrong'),false);
  assert.equal(a.acceptCallback(a.redirectUri+'?state=wrong&code=wrong'),false);
  const state=url.searchParams.get('state');assert.equal(a.acceptCallback(a.redirectUri+'?state='+state+'&state='+state+'&code=wrong'),false);
  assert.equal(a.acceptCallback(a.redirectUri+'?state='+state+'&code=synthetic-code'),true);
  const result=await a.result;assert.equal(result.code,'synthetic-code');assert.equal(createHash('sha256').update(result.verifier).digest('base64url'),url.searchParams.get('code_challenge'));
  assert.equal(a.acceptCallback(a.redirectUri+'?state='+state+'&code=replay'),false);
 }finally{a.cancel();}
});
test('Google callback listens only on loopback, rejects wrong paths, and stops after success',async()=>{
 const a=await createAuthorizationAttempt('google','test.apps.googleusercontent.com');
 try{const uri=new URL(a.redirectUri);assert.equal(uri.hostname,'127.0.0.1');assert.notEqual(uri.port,'');const state=new URL(a.url).searchParams.get('state');
  assert.equal((await fetch(a.redirectUri.replace('/oauth2/callback','/wrong')+'?state='+state+'&code=wrong')).status,400);
  assert.equal((await fetch(a.redirectUri+'?state='+state+'&code=synthetic-code')).status,200);
  assert.equal((await a.result).code,'synthetic-code');
 }finally{a.cancel();}
});
test('cancel, provider denial and timeout settle pending authorization without tokens',async()=>{
 const a=await createAuthorizationAttempt('yahoo','synthetic-client');a.cancel();await assert.rejects(a.result,/cancel/i);
 const b=await createAuthorizationAttempt('yahoo','synthetic-client');const state=new URL(b.url).searchParams.get('state');b.acceptCallback(b.redirectUri+'?state='+state+'&error=access_denied');await assert.rejects(b.result,/denied/i);
 const c=await createAuthorizationAttempt('yahoo','synthetic-client',{timeoutMs:10});await assert.rejects(c.result,/expired/i);
});
test('provider identity determines mailbox and tokens never become passwords',()=>{
 const a=providerAccount('google',{email:'sample@gmail.com',email_verified:true,sub:'synthetic-sub'},{clientId:'client',accessToken:'synthetic-access',refreshToken:'synthetic-refresh',expiresAt:12345});
 assert.equal(a.host,'imap.gmail.com');assert.equal(a.email,'sample@gmail.com');assert.equal(a.password,undefined);assert.equal(a.oauth.accessToken,'synthetic-access');
 assert.throws(()=>providerAccount('google',{email:'sample@gmail.com',email_verified:false,sub:'one'},{}));
});
const {createOAuthService,requestJSON}=require('../apps/desktop/oauth-service.cjs');
function serviceHarness(records=[],overrides={}){
 let stored=structuredClone(records),opened=0;const calls=[];
 const vault={available:async()=>true,list:async()=>structuredClone(stored),update:async change=>{stored=change(stored);return stored;}};
 const service=createOAuthService({vault,config:{google:{clientId:'test.apps.googleusercontent.com'},yahoo:{clientId:'synthetic-client'}},openExternal:async()=>{opened++;},startAttempt:async()=>({url:'https://accounts.google.com/o/oauth2/v2/auth',result:Promise.resolve({code:'synthetic-code',verifier:'synthetic-verifier',redirectUri:'http://127.0.0.1:12345/oauth2/callback'}),cancel(){},acceptCallback:()=>false}),request:async(url,options)=>{calls.push({url,options});return url.endsWith('/token')?{access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,token_type:'Bearer'}:{email:'sample@gmail.com',email_verified:true,sub:'synthetic-sub'};},testInbox:async()=>{},testSmtp:async()=>{},...overrides});
 return {service,calls,records:()=>stored,opened:()=>opened};
}
test('browser login persists encrypted-vault tokens only after verified identity/mailbox and returns a public summary',async()=>{
 const h=serviceHarness();const result=await h.service.signIn({provider:'google'});assert.equal(result.email,'sample@gmail.com');assert.equal(h.opened(),1);assert.equal(h.records()[0].oauth.refreshToken,'synthetic-refresh');assert.equal(result.oauth,undefined);assert.equal(result.authType,'oauth2');assert.equal(h.calls[0].options.body.code_verifier,'synthetic-verifier');
});
test('unregistered and failed logins do not open a browser or change existing accounts',async()=>{
 const h=serviceHarness([],{config:{}});await assert.rejects(h.service.signIn({provider:'google'}),/registration/i);assert.equal(h.opened(),0);assert.deepEqual(h.records(),[]);
 const failed=serviceHarness([],{testInbox:async()=>{throw new Error('private response');}});await assert.rejects(failed.service.signIn({provider:'google'}));assert.deepEqual(failed.records(),[]);
});
test('refresh rotates tokens atomically and cannot redirect OAuth credentials to arbitrary mail hosts',async()=>{
 const account={...providerAccount('google',{email:'sample@gmail.com',email_verified:true,sub:'one'},{clientId:'test.apps.googleusercontent.com',refreshToken:'old-refresh',accessToken:'old-access',expiresAt:0}),id:'one'};
 const h=serviceHarness([account]);const prepared=await h.service.prepare(account);assert.equal(prepared.oauth.accessToken,'synthetic-access');assert.equal(h.records()[0].oauth.refreshToken,'synthetic-refresh');assert.equal(h.calls[0].options.body.grant_type,'refresh_token');
 await assert.rejects(h.service.prepare({...account,host:'evil.example'}));
});
test('reconnect cannot overwrite a different authorized identity',async()=>{
 const original={...providerAccount('google',{email:'other@gmail.com',email_verified:true,sub:'other'},{clientId:'test.apps.googleusercontent.com',refreshToken:'old',accessToken:'old',expiresAt:0}),id:'saved'};
 const h=serviceHarness([original]);await assert.rejects(h.service.signIn({provider:'google',accountId:'saved'}),/same account/i);assert.deepEqual(h.records(),[original]);
});
test('token transport refuses arbitrary endpoints and redirects',async()=>{
 await assert.rejects(requestJSON('http://127.0.0.1/token',{}));
 await assert.rejects(requestJSON('https://evil.example/token',{}));
});
test('only one authorization can start even while credential storage readiness is pending',async()=>{
 let release;const ready=new Promise(resolve=>{release=resolve;});let opened;
 const seen=new Promise(resolve=>{opened=resolve;});
 const records=[];const vault={available:async()=>{await ready;return true;},list:async()=>records,update:async f=>f(records)};
 const service=createOAuthService({vault,config:{google:{clientId:'test.apps.googleusercontent.com'}},openExternal:async()=>opened(),testInbox:async()=>{},testSmtp:async()=>{},startAttempt:(id,clientId)=>createAuthorizationAttempt(id,clientId,{timeoutMs:200})});
 const first=service.signIn({provider:'google'});first.catch(()=>{});
 const second=service.signIn({provider:'google'});second.catch(()=>{});
 release();await seen;service.cancel();
 await assert.rejects(first);await assert.rejects(second,/already in progress/);
});
test('OAuth IMAP authentication uses access tokens without password fallback',async()=>{
 const {withInbox}=require('../apps/desktop/accounts.cjs');let options;
 class Client{constructor(o){options=o;}on(){}async connect(){}async getMailboxLock(){return {release(){}};}async logout(){}}
 const account=providerAccount('google',{email:'sample@gmail.com',email_verified:true,sub:'one'},{accessToken:'synthetic-access'});
 await withInbox(account,async()=>{}, {resolve:async()=>[{address:'8.8.8.8'}],Client});assert.deepEqual(options.auth,{user:'sample@gmail.com',accessToken:'synthetic-access'});assert.equal(options.auth.pass,undefined);
});
test('OAuth IPC rejects foreign windows and strips unexpected failure details',async()=>{
 const {registerOAuthIPC}=require('../apps/desktop/oauth-ipc.cjs');const handlers={},contents={mainFrame:{url:'mademail://app/'}};
 registerOAuthIPC({handle:(name,fn)=>handlers[name]=fn},()=>({webContents:contents}),{status:()=>[],signIn:()=>{throw new Error('synthetic-refresh-secret');}});
 assert.equal((await handlers['accounts:signIn']({sender:{},senderFrame:contents.mainFrame},{})).ok,false);
 const r=await handlers['accounts:signIn']({sender:contents,senderFrame:contents.mainFrame},{});assert.equal(r.ok,false);assert.equal(JSON.stringify(r).includes('synthetic-refresh-secret'),false);
});

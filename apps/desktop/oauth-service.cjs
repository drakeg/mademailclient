const {randomUUID}=require('node:crypto');
const {provider,providerStatus,providerAccount,validClientId,assertProviderHosts}=require('./oauth-providers.cjs');
const {createAuthorizationAttempt}=require('./oauth-flow.cjs');
const {emailAddress}=require('./mail-network.cjs');
const {accountSummary}=require('./accounts.cjs');
function oauthError(code,message){return Object.assign(new Error(message),{publicCode:code,publicMessage:message});}
async function requestJSON(url,{method='POST',body,accessToken,signal}={}){
 const allowed=['google','yahoo'].flatMap(id=>{const p=provider(id);return [p.token,p.userinfo];});
 if(!allowed.includes(url))throw new Error('Unapproved OAuth endpoint');
 const response=await fetch(url,{method,redirect:'error',credentials:'omit',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),headers:{Accept:'application/json',...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(accessToken?{Authorization:'Bearer '+accessToken}:{})},...(body?{body:new URLSearchParams(body).toString()}: {})});
 if(Number(response.headers.get('content-length'))>65536){await response.body?.cancel();throw new Error('OAuth response too large');}
 const reader=response.body?.getReader();let length=0;const chunks=[];
 if(reader)try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>65536)throw new Error('OAuth response too large');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
 let data;try{data=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new Error('Invalid OAuth response');}
 if(!response.ok)throw oauthError(data.error==='invalid_grant'?'REAUTHORIZE':'PROVIDER_UNAVAILABLE',data.error==='invalid_grant'?'Authorization expired or was revoked. Reconnect this account.':'Provider authorization failed. Please try again.');
 return data;
}
function tokenSet(data,previous={},requiredScopes=[]){
 const token=value=>typeof value==='string'&&/^[\x21-\x7e]{1,16384}$/.test(value);
 const lifetime=Number(data.expires_in);
 if(!token(data.access_token)||!Number.isFinite(lifetime)||lifetime<=0||lifetime>86400||(data.token_type&&data.token_type.toLowerCase()!=='bearer'))throw new Error('Invalid token response');
 const refresh=data.refresh_token||previous.refreshToken;if(!token(refresh))throw oauthError('REAUTHORIZE','The provider did not grant offline access. Reconnect and approve access.');
 const scope=typeof data.scope==='string'?data.scope:previous.scope||requiredScopes.join(' ');
 if(!requiredScopes.every(s=>scope.split(' ').includes(s)))throw new Error('Required mail permission was not granted');
 return {accessToken:data.access_token,refreshToken:refresh,expiresAt:Date.now()+lifetime*1000,scope};
}
function createOAuthService({vault,config={},openExternal,testInbox,testSmtp,request=requestJSON,startAttempt=createAuthorizationAttempt,nativeCallbackReady=true}){
 let pending=null;const refreshing=new Map();
 const status=()=>providerStatus(config).map(p=>p.id==='yahoo'&&p.available&&!nativeCallbackReady?{...p,available:false,reason:'Install the packaged desktop app to register the Yahoo sign-in callback.'}:p);
 const cancel=()=>{pending?.controller.abort();pending?.attempt?.cancel();};
 async function signIn(input){
  if(!input||typeof input!=='object'||!validClientId(input.provider,config[input.provider]?.clientId))throw oauthError('REGISTRATION_REQUIRED','Publisher app registration is required before browser sign-in is available.');
  const id=input.provider,p=provider(id),clientId=config[id].clientId;
  if(id==='yahoo'&&!nativeCallbackReady)throw oauthError('INSTALL_REQUIRED','Install the packaged desktop app to register the Yahoo sign-in callback.');
  if(pending)throw oauthError('SIGN_IN_BUSY','Another sign-in is already in progress.');
  if(input.emailHint)emailAddress(input.emailHint);
  const session={controller:new AbortController(),attempt:null};pending=session;
  try{
   const original=input.accountId?(await vault.list()).find(a=>a.id===input.accountId):null;
   if(input.accountId&&!original)throw new Error('Account no longer exists');
   if(vault.available&&!await vault.available())throw new Error('OS credential storage unavailable');
   session.controller.signal.throwIfAborted();
   session.attempt=await startAttempt(id,clientId,{emailHint:input.emailHint});
   if(session.controller.signal.aborted)throw new Error('Cancelled');
   await openExternal(session.attempt.url);
   const code=await session.attempt.result;
   const data=await request(p.token,{body:{client_id:clientId,grant_type:'authorization_code',code:code.code,code_verifier:code.verifier,redirect_uri:code.redirectUri},signal:session.controller.signal});
   const tokens=tokenSet(data,{},p.scopes.filter(s=>s.includes('mail')));
   const profile=await request(p.userinfo,{method:'GET',accessToken:tokens.accessToken,signal:session.controller.signal});
   const account=providerAccount(id,profile,{clientId,...tokens});
   if(original&&(original.email.toLowerCase()!==account.email.toLowerCase()||(original.oauth&&(original.oauth.provider!==id||original.oauth.subject!==account.oauth.subject))))throw oauthError('ACCOUNT_MISMATCH','Choose the same account when reconnecting. No settings were changed.');
   account.id=original?.id||randomUUID();
   await testInbox(account);
   // Yahoo currently requests mail-r only. Do not request write scope merely to test SMTP.
   if(id==='google')await testSmtp({...account.smtp,accessToken:tokens.accessToken});
   session.controller.signal.throwIfAborted();
   await vault.update(all=>{
    if(original&&!all.some(a=>a.id===original.id))throw new Error('Account removed during sign-in');
    if(all.some(a=>a.id!==account.id&&a.email.toLowerCase()===account.email.toLowerCase()&&a.host===account.host))throw oauthError('DUPLICATE_ACCOUNT','Account already exists. Use Reconnect on the saved account.');
    return original?all.map(a=>a.id===account.id?account:a):[...all,account];
   });
   return accountSummary(account);
  }finally{session.attempt?.cancel();session.controller.abort();if(pending===session)pending=null;}
 }
 async function prepare(account){
  if(!account.oauth)return account;assertProviderHosts(account);
  if(account.oauth.expiresAt>Date.now()+60000)return account;
  if(refreshing.has(account.id))return refreshing.get(account.id);
  const task=(async()=>{
   const p=provider(account.oauth.provider),old=account.oauth;
   const data=await request(p.token,{body:{grant_type:'refresh_token',client_id:old.clientId,refresh_token:old.refreshToken}});
   const next={...account,oauth:{...old,...tokenSet(data,old,p.scopes.filter(s=>s.includes('mail')))}};
   await vault.update(all=>{if(!all.some(a=>a.id===account.id&&a.oauth?.refreshToken===old.refreshToken))throw new Error('Account changed during refresh');return all.map(a=>a.id===account.id?next:a);});return next;
  })();refreshing.set(account.id,task);try{return await task;}finally{refreshing.delete(account.id);}
 }
 return {status,signIn,prepare,cancel,acceptCallback:url=>pending?.attempt?.acceptCallback(url)||false};
}
module.exports={createOAuthService,requestJSON};

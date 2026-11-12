const http=require('node:http');
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {provider}=require('./oauth-providers.cjs');
async function createAuthorizationAttempt(id,clientId,{emailHint,timeoutMs=300000}={}){
 const p=provider(id),state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
 let server,redirectUri=p.callback,done=false,timer,resolve,reject;
 const result=new Promise((yes,no)=>{resolve=yes;reject=no;});result.catch(()=>{});
 function finish(error,value){if(done)return;done=true;clearTimeout(timer);server?.close();error?reject(error):resolve(value);}
 function acceptCallback(value){
  if(done||typeof value!=='string'||value.length>8192)return false;
  let url,expected;try{url=new URL(value);expected=new URL(redirectUri);}catch{return false;}
  if(url.protocol!==expected.protocol||url.host!==expected.host||url.pathname!==expected.pathname||url.username||url.password||url.hash)return false;
  const received=url.searchParams.getAll('state');
  if(received.length!==1||Buffer.byteLength(received[0])!==Buffer.byteLength(state)||!timingSafeEqual(Buffer.from(received[0]),Buffer.from(state)))return false;
  if(url.searchParams.getAll('error').length>1||url.searchParams.getAll('code').length>1)return false;
  const error=url.searchParams.get('error'),code=url.searchParams.get('code');
  if(error){finish(new Error(error==='access_denied'?'Sign-in was denied.':'Provider sign-in failed.'));return true;}
  if(!code||code.length>4096)return false;
  finish(null,{code,verifier,redirectUri});return true;
 }
 if(p.callback==='loopback'){
  server=http.createServer({maxHeaderSize:8192},(req,res)=>{
   const valid=req.method==='GET'&&!req.headers.origin&&req.headers.host===new URL(redirectUri).host&&acceptCallback(redirectUri.split('/oauth2/callback')[0]+req.url);
   res.writeHead(valid?200:400,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Connection':'close'});
   res.end(valid?'Authorization response received. Return to Made Mail to finish connecting.':'Invalid authorization response. Return to Made Mail and try again.');
  });
  server.requestTimeout=10000;server.headersTimeout=10000;
  await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
  redirectUri=`http://127.0.0.1:${server.address().port}/oauth2/callback`;
 }
 timer=setTimeout(()=>finish(new Error('Sign-in expired. Please try again.')),timeoutMs);
 const url=new URL(p.authorization);
 for(const [key,value]of Object.entries({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:p.scopes.join(' '),state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}))url.searchParams.set(key,value);
 if(id==='google'){url.searchParams.set('access_type','offline');url.searchParams.set('prompt','consent select_account');}
 if(emailHint)url.searchParams.set('login_hint',emailHint);
 return {url:url.href,redirectUri,result,acceptCallback,cancel:()=>finish(new Error('Sign-in cancelled.'))};
}
module.exports={createAuthorizationAttempt};

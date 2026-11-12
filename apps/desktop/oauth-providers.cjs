const {emailAddress}=require('./mail-network.cjs');
const providers={
 google:{name:'Gmail',authorization:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',userinfo:'https://openidconnect.googleapis.com/v1/userinfo',scopes:['openid','email','https://mail.google.com/'],imap:'imap.gmail.com',smtp:'smtp.gmail.com',callback:'loopback'},
 yahoo:{name:'Yahoo Mail',authorization:'https://api.login.yahoo.com/oauth2/request_auth',token:'https://api.login.yahoo.com/oauth2/get_token',userinfo:'https://api.login.yahoo.com/openid/v1/userinfo',scopes:['openid','email','mail-r'],imap:'imap.mail.yahoo.com',smtp:'smtp.mail.yahoo.com',callback:'com.mademailclient.auth://yahoo/callback'},
};
function provider(id){if(!Object.hasOwn(providers,id))throw new Error('Unsupported provider');return providers[id];}
function validClientId(id,value){return typeof value==='string'&&value.length>4&&value.length<2048&&/^[A-Za-z0-9_.-]+$/.test(value)&&(id!=='google'||value.endsWith('.apps.googleusercontent.com'));}
function providerStatus(config){return Object.entries(providers).map(([id,p])=>({id,name:p.name,available:validClientId(id,config[id]?.clientId),reason:validClientId(id,config[id]?.clientId)?'Opens your default browser for provider authorization.':'Publisher app registration is required before browser sign-in is available in this build.'}));}
function providerAccount(id,profile,tokens){
 const p=provider(id),email=emailAddress(profile.email);
 if(typeof profile.sub!=='string'||!profile.sub||profile.sub.length>512||profile.email_verified===false||(id==='google'&&profile.email_verified!==true))throw new Error('Provider identity could not be verified');
 return {email,host:p.imap,port:993,security:'tls',username:email,smtp:{host:p.smtp,port:465,security:'tls',username:email,useIncomingAuth:true},oauth:{provider:id,subject:profile.sub,...tokens}};
}
function assertProviderHosts(account){
 const p=provider(account.oauth.provider);
 if(account.host!==p.imap||account.port!==993||account.security!=='tls'||account.username!==account.email||account.smtp?.host!==p.smtp||account.smtp?.port!==465||account.smtp?.security!=='tls'||account.smtp?.username!==account.email)throw new Error('OAuth accounts must use their provider servers');
}
module.exports={provider,providerStatus,providerAccount,validClientId,assertProviderHosts};

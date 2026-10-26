const { Resolver } = require('node:dns/promises');
const { emailAddress, endpoint } = require('./mail-network.cjs');
// Provider settings are suggestions only. Authentication still requires an explicit save.
const presets = [
 {domains:['gmail.com','googlemail.com'],name:'Gmail',imap:'imap.gmail.com',smtp:'smtp.gmail.com',port:465,security:'tls',note:'Use an app password if your Google account permits it. OAuth sign-in is not available yet.'},
 {domains:['icloud.com','me.com','mac.com'],name:'iCloud',imap:'imap.mail.me.com',smtp:'smtp.mail.me.com',port:587,security:'starttls',note:'Use an Apple app-specific password. If needed, change the incoming username to the part before @ and use separate SMTP credentials with the full address.'},
 {domains:['outlook.com','hotmail.com','live.com','msn.com'],name:'Outlook.com',imap:'outlook.office365.com',smtp:'smtp-mail.outlook.com',port:587,security:'starttls',requiresOAuth:true,note:'Microsoft requires OAuth sign-in, which Made Mail does not support yet. Finding these settings does not enable account connection.'},
 {domains:['yahoo.com','ymail.com','rocketmail.com'],name:'Yahoo Mail',imap:'imap.mail.yahoo.com',smtp:'smtp.mail.yahoo.com',port:465,security:'tls',note:'Use a Yahoo app password. Provider account policies still apply.'},
 {domains:['fastmail.com','fastmail.fm'],name:'Fastmail',imap:'imap.fastmail.com',smtp:'smtp.fastmail.com',port:465,security:'tls',note:'Use a Fastmail app password with mail access.'},
];
function srvEndpoint(records, protocol, port, security) {
 if(!Array.isArray(records)||records.length>100)return null;
 for(const record of [...records].sort((a,b)=>a.priority-b.priority||b.weight-a.weight)){
  if(!record||!Number.isInteger(record.priority)||record.priority<0||record.priority>65535||record.port!==port)continue;
  try{return endpoint({host:typeof record.name==='string'?record.name.replace(/\.$/,''):null,port,security},protocol);}catch{/* Ignore malformed/unsupported records, never weaken TLS. */}
 }
 return null;
}
async function discoverAccount(value, {resolveSrv,timeoutMs=3000}={}) {
 const email=emailAddress(value),domain=email.split('@')[1].toLowerCase();
 const preset=presets.find(p=>p.domains.includes(domain));
 if(preset)return {source:'Built-in provider settings',provider:preset.name,requiresOAuth:!!preset.requiresOAuth,note:preset.note,
  imap:{host:preset.imap,port:993,security:'tls',username:email},smtp:{host:preset.smtp,port:preset.port,security:preset.security,username:email}};
 const resolver=resolveSrv?null:new Resolver({timeout:1500,tries:1});
 const query=resolveSrv||resolver.resolveSrv.bind(resolver);
 const services=[['imaps','imap',993,'tls'],['imap','imap',143,'starttls'],['submissions','smtp',465,'tls'],['submission','smtp',587,'starttls']];
 let timer;
 try {
  const results=await Promise.race([
   Promise.all(services.map(async([service,protocol,port,security])=>{try{return srvEndpoint(await query(`_${service}._tcp.${domain}`),protocol,port,security);}catch{return null;}})),
   new Promise(resolve=>{timer=setTimeout(()=>resolve([null,null,null,null]),timeoutMs);})
  ]);
  const imap=results[0]||results[1],smtp=results[2]||results[3];
  return {source:'Domain DNS SRV records',provider:null,requiresOAuth:false,imap:imap?{...imap,username:email}:null,smtp:smtp?{...smtp,username:email}:null,
   note:imap||smtp?'Review the suggested servers before connecting. DNS discovery does not verify ownership or authentication.':'No supported server settings found. Enter the settings supplied by your email provider manually.'};
 } finally {clearTimeout(timer);resolver?.cancel();}
}
module.exports={discoverAccount};

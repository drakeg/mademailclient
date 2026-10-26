const nodemailer = require('nodemailer');
const { publicHost, endpoint, field } = require('./mail-network.cjs');
// verify() negotiates TLS and authenticates, but never submits a message.
async function verifySmtp(input, {resolve, createTransport=nodemailer.createTransport}={}) {
 const smtp={...endpoint(input,'smtp'),username:field(input.username,'SMTP username'),password:field(input.password,'SMTP password',1024)};
 const address=await publicHost(smtp.host,resolve);
 const transport=createTransport({host:address,port:smtp.port,secure:smtp.security==='tls',requireTLS:true,forceAuth:true,
  tls:{servername:smtp.host,rejectUnauthorized:true,minVersion:'TLSv1.2'},auth:{user:smtp.username,pass:smtp.password},
  logger:false,debug:false,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,
  disableFileAccess:true,disableUrlAccess:true,name:'mademail.local'});
 try {await transport.verify();} finally {transport.close();}
}
module.exports={verifySmtp};

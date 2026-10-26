const { isIP, BlockList } = require('node:net');
const { lookup } = require('node:dns/promises');
const blocked = new BlockList();
for (const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['100.64.0.0',10],['192.0.0.0',24],['198.18.0.0',15],['192.0.2.0',24],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]]) blocked.addSubnet(address,prefix,'ipv4');
function publicAddress(address) {
 // IPv6 is deliberately restricted to global unicast, excluding mapped IPv4.
 return isIP(address)===4 ? !blocked.check(address,'ipv4') : isIP(address)===6 && /^[23][0-9a-f]{3}:/i.test(address) && !address.toLowerCase().startsWith('2001:db8:');
}

function field(value, name, max=254) {
 if(typeof value!=='string'||!value.trim()||value.length>max||/[\r\n\0]/.test(value))throw new Error('Check '+name);
 return name.toLowerCase().includes('password')?value:value.trim();
}
function hostname(value) {
 const host=field(value,'server hostname',253).toLowerCase();
 if(! /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)||host.endsWith('.local')||host.endsWith('.localhost'))throw new Error('Use a public mail server hostname');
 return host;
}
function emailAddress(value) {
 const email=field(value,'email address');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Use a valid email address');
 hostname(email.split('@')[1]);return email;
}
function endpoint(value, protocol) {
 const host=hostname(value.host);
 const port=value.port===undefined?(protocol==='imap'?993:587):Number(value.port);
 const security=value.security===undefined?'tls':value.security;
 const pairs=protocol==='imap'?[[993,'tls'],[143,'starttls']]:[[465,'tls'],[587,'starttls']];
 if(!pairs.some(([p,s])=>port===p&&security===s))throw new Error('Choose a supported port and TLS mode');
 return {host,port,security};
}
async function publicHost(host, resolve=lookup) {
 hostname(host);
 const addresses=await resolve(host,{all:true});
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('Use a public mail server');
 return addresses[0].address;
}
module.exports={publicAddress,publicHost,field,hostname,emailAddress,endpoint};

// Public native-client IDs only. Never accept confidential client secrets here.
import {writeFile,rename} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {validClientId}=createRequire(import.meta.url)('../apps/desktop/oauth-providers.cjs');
const config={google:{clientId:process.env.MADEMAIL_GOOGLE_CLIENT_ID||''},yahoo:{clientId:process.env.MADEMAIL_YAHOO_CLIENT_ID||''}};
for(const [id,value]of Object.entries(config))if(value.clientId&&!validClientId(id,value.clientId))throw new Error('Invalid public OAuth client ID for '+id);
const file=new URL('../apps/desktop/oauth-clients.json',import.meta.url),temp=new URL('../apps/desktop/oauth-clients.json.tmp',import.meta.url);
await writeFile(temp,JSON.stringify(config,null,2)+'\n');await rename(temp,file);
console.log('Public OAuth client configuration written. Provider registration/approval must be verified separately.');

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(import.meta.dirname);
const types = {'.html':'text/html', '.css':'text/css', '.mjs':'text/javascript'};
http.createServer(async (req,res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname === '/' ? '/apps/web/index.html' : url.pathname;
  if (!/^\/(apps\/web|packages\/core)\/[a-zA-Z0-9./_-]+$/.test(path) || path.includes('..')) {res.writeHead(404).end(); return;}
  try { const data = await readFile(resolve(root, '.'+path)); res.writeHead(200, {'Content-Type':types[extname(path)] || 'text/plain','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'"}).end(data); }
  catch {res.writeHead(404).end();}
}).listen(3000, '127.0.0.1', () => console.log('Made Mail demo: http://127.0.0.1:3000'));

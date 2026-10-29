import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// Production HTTP tests with a local TLS Redis REST test double. No live secrets needed.
const dir = mkdtempSync(join(tmpdir(), 'amt-security-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir,'key.pem'), '-out', join(dir,'cert.pem'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], {stdio:'ignore'});
const store = new Map(); let now = Date.now(); let outage = false;
const redis = createServer({key:readFileSync(join(dir,'key.pem')),cert:readFileSync(join(dir,'cert.pem'))}, async (req,res) => {
  if(outage) { res.writeHead(503).end(); return; }
  assert.equal(req.headers.authorization, 'Bearer test-token');
  let body=''; for await(const chunk of req) body+=chunk;
  const [op,key,value,...args]=JSON.parse(body); let result;
  if(op==='SET') { store.set(key,{value,expires:now+Number(args[1])*1000}); result='OK'; }
  else if(op==='GET') {const row=store.get(key);result=row && row.expires>now ? row.value : null;}
  else if(op==='DEL') result=Number(store.delete(key));
  else if(op==='EVAL') { const k=args[0];let row=store.get(k); if(!row || row.expires<=now) row={value:0,expires:now+900000}; row.value++;store.set(k,row);result=row.value; }
  else throw new Error('Unexpected Redis command');
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({result}));
});
await new Promise(resolve=>redis.listen(0,'127.0.0.1',resolve));
const redisPort=redis.address().port;
const password=randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',ADMIN_PASSWORD:password,SESSION_SECRET:randomBytes(32).toString('hex'),APP_ORIGIN:'https://dashboard.test',AUTH_REDIS_REST_URL:`https://localhost:${redisPort}`,AUTH_REDIS_REST_TOKEN:'test-token',NODE_EXTRA_CA_CERTS:join(dir,'cert.pem'),SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:''};
const processes=[];
async function start(port,overrides={}) {
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port),'--hostname','127.0.0.1'],{env:{...env,...overrides},stdio:['ignore','pipe','pipe']}); processes.push(child);
 let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 for(let i=0;i<150;i++){try{await fetch(`http://127.0.0.1:${port}/login`);return;}catch{}if(child.exitCode!==null) throw new Error('Server failed to start; inspect local Next.js startup/build configuration');await new Promise(r=>setTimeout(r,100));}
 throw new Error('Server start timed out');
}
const base=process.env.SECURITY_TEST_PORT ? Number(process.env.SECURITY_TEST_PORT) : 3417;
const request=(path,options={},port=base)=>fetch(`http://127.0.0.1:${port}${path}`,{redirect:'manual',...options});
const post=(path,body='',cookie='',origin=env.APP_ORIGIN,port=base)=>request(path,{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded',cookie},body},port);
let checks=0;
async function status(path,expected,options={},port=base) {const r=await request(path,options,port);assert.equal(r.status,expected,`${path}: ${r.status}`); checks++;return r;}
try {
 await start(base);await start(base+1);await start(base+2,{ADMIN_PASSWORD:''});
 for(const path of ['/','/visitors','/brand/amt-logo.png','/_next/image?url=%2Fbrand%2Famt-logo.png&w=64&q=75']) await status(path,303);
 for(const path of ['/api/conversations','/api/conversations/11111111-1111-4111-8111-111111111111/messages','/api/visitors/11111111-1111-4111-8111-111111111111/history']) {
  await status(path,401);await status(path,401,{headers:{cookie:'__Host-amt_admin='+ 'f'.repeat(64),'x-middleware-subrequest':'middleware:middleware:middleware:middleware:middleware'}});
 }
 let r=await status('/login',200);assert.match(await r.text(),/type="password"/);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(r.headers.get('cache-control'),/no-store/);checks+=3;
 assert.equal((await post('/api/auth/login','password=x','','https://evil.test')).status,403);checks++;
 assert.equal((await post('/api/auth/login','password=x','','')).status,403);checks++;
 assert.equal((await post('/api/auth/login','password=wrong')).status,401);checks++;
 r=await post('/api/auth/login',new URLSearchParams({password}).toString());assert.equal(r.status,303);
 const setCookie=r.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/Secure/i);assert.match(setCookie,/SameSite=strict/i);assert.match(setCookie,/Max-Age=28800/);checks+=5;
 const cookie=setCookie.split(';')[0];
 await status('/brand/amt-logo.png',200,{headers:{cookie}},base+1); // Shared store accepts session on another instance.
 await status('/api/visitors/not-a-uuid/history',404,{headers:{cookie}});
 r=await status('/',200,{headers:{cookie}});const html=await r.text();assert.doesNotMatch(html,/Ali Khan|25kg AMT/);assert.match(html,/<script[^>]*nonce=/);checks+=2;
 await status('/visitors',200,{headers:{cookie}});
 const raw=cookie.split('=')[1];const changed=cookie.split('=')[0]+'='+(raw[0]==='a'?'b':'a')+raw.slice(1);
 await status('/api/conversations',401,{headers:{cookie:changed}});
 outage=true;assert.equal((await post('/api/auth/logout','',cookie)).status,503);checks++;outage=false;
 await status('/brand/amt-logo.png',200,{headers:{cookie}});
 assert.equal((await post('/api/auth/logout','',cookie,'https://evil.test')).status,403);checks++;
 await status('/brand/amt-logo.png',200,{headers:{cookie}});
 assert.equal((await post('/api/auth/logout','',cookie)).status,303);checks++;
 await status('/brand/amt-logo.png',303,{headers:{cookie}},base+1);
 r=await post('/api/auth/login',new URLSearchParams({password}).toString());const expiring=r.headers.get('set-cookie').split(';')[0];now+=28801000;
 await status('/api/conversations',401,{headers:{cookie:expiring}});
 store.clear();
 const attempts=await Promise.all(Array.from({length:40},(_,i)=>post('/api/auth/login','password=wrong','',env.APP_ORIGIN,base+i%2)));
 assert.equal(attempts.filter(r=>r.status===401).length,30);assert.equal(attempts.filter(r=>r.status===429).length,10);assert.equal(attempts.find(r=>r.status===429).headers.get('retry-after'),'900');checks+=3;
 for(const path of ['/','/login','/api/conversations','/brand/amt-logo.png'])await status(path,503,{},base+2);
 now+=900001;assert.equal((await post('/api/auth/login','password=wrong')).status,401);checks++;
 outage=true;await status('/api/conversations',503,{headers:{cookie:expiring}});assert.equal((await post('/api/auth/login','password=wrong')).status,503);checks++;
 await status('/api/track',403,{method:'POST',headers:{origin:'https://evil.test'},body:'{}'});
 await status('/api/track',204,{method:'OPTIONS',headers:{origin:'https://www.amustafatraders.com'}});
 await status('/api/track',400,{method:'POST',headers:{origin:'https://www.amustafatraders.com','content-type':'application/json'},body:'null'});
 console.log(`PASS: ${checks} production security assertions (three server instances; TLS Redis test double).`);
} finally {for(const p of processes) p.kill('SIGTERM');await new Promise(r=>redis.close(r));rmSync(dir,{recursive:true,force:true});}

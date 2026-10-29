import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import ts from 'typescript';
const source=readFileSync('lib/auth.ts','utf8').replace('import "server-only";','');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const auth=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
const original={...process.env};const originalFetch=globalThis.fetch;
const good={NODE_ENV:'production',ADMIN_PASSWORD:randomBytes(32).toString('hex'),SESSION_SECRET:randomBytes(32).toString('hex'),APP_ORIGIN:'https://dashboard.test',AUTH_REDIS_REST_URL:'https://store.test',AUTH_REDIS_REST_TOKEN:randomBytes(32).toString('hex')};
let checks=0;
try {
 Object.assign(process.env,good);assert.doesNotThrow(auth.config);checks++;
 for(const name of Object.keys(good).filter(x=>x!=='NODE_ENV')) {process.env[name]='';assert.throws(auth.config,undefined,name);process.env[name]=good[name];checks++;}
 for(const [name,value] of [['ADMIN_PASSWORD','short'],['SESSION_SECRET','short'],['APP_ORIGIN','http://dashboard.test'],['APP_ORIGIN','https://dashboard.test/'],['APP_ORIGIN','https://user:pass@dashboard.test'],['AUTH_REDIS_REST_URL','http://store.test']]) {process.env[name]=value;assert.throws(auth.config);process.env[name]=good[name];checks++;}
 const store=new Map();let counter=1;
 globalThis.fetch=async (_url,options)=>{
  const [op,key,value]=JSON.parse(options.body);
  let result;
  if(op==='SET'){store.set(key,value);result='OK';}
  else if(op==='GET')result=store.get(key)??null;
  else if(op==='DEL')result=Number(store.delete(key));
  else if(op==='EVAL')result=counter;
  return Response.json({result});
 };
 const token=await auth.createSession();assert.equal(await auth.validSession(token),true);checks++;
 process.env.ADMIN_PASSWORD=randomBytes(32).toString('hex');assert.equal(await auth.validSession(token),false);checks++;
 process.env.ADMIN_PASSWORD=good.ADMIN_PASSWORD;process.env.SESSION_SECRET=randomBytes(32).toString('hex');assert.equal(await auth.validSession(token),false);checks++;
 process.env.SESSION_SECRET=good.SESSION_SECRET;
 for(const invalid of [null,0,-1,'1',1.5,{},undefined]) {counter=invalid;await assert.rejects(auth.allowAttempt);checks++;}
 globalThis.fetch=async()=>Response.json({error:'test failure'});await assert.rejects(auth.createSession);checks++;
 assert.equal(auth.sameOrigin(new Request('https://dashboard.test',{headers:{origin:good.APP_ORIGIN,'sec-fetch-site':'cross-site'}})),false);checks++;
 console.log(`PASS: ${checks} configuration, credential rotation, invalid store response, and CSRF assertions.`);
} finally {
 globalThis.fetch=originalFetch;
 for(const name of Object.keys(good)) {if(original[name]===undefined)delete process.env[name];else process.env[name]=original[name];}
}

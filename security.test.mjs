import test from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync} from 'node:crypto';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {handleRequest} from '../server/app.mjs';
import {openDatabase} from '../server/sqlite-adapter.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),origin='https://board.example';
const salt='00112233445566778899aabbccddeeff';
const env={APP_USERNAME:'test-owner',APP_PASSWORD_HASH:`pbkdf2-sha256:100000:${salt}:${pbkdf2Sync('test-only-password',Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex')}`};
const setup=()=>openDatabase(':memory:',root);
async function login(db){const res=await handleRequest(new Request(origin+'/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'username=test-owner&password=test-only-password'}),env,db);assert.equal(res.status,303);return res.headers.get('set-cookie').split(';')[0];}
test('anonymous requests cannot access the plan, application code, PDF or saved notes',async()=>{const db=setup();for(const path of ['/','/app.js','/core.mjs','/app.css','/index.html','/resources/engineering-plan.pdf','/resources/engineering-roadmaps.pdf']){const res=await handleRequest(new Request(origin+path),env,db);assert.equal(res.status,303,path);assert.equal(res.headers.get('location'),'/login');assert.equal(await res.text(),'');}for(const path of ['/api/plan','/api/state'])assert.equal((await handleRequest(new Request(origin+path),env,db)).status,401);const page=await handleRequest(new Request(origin+'/login'),env,db);const html=await page.text();assert.equal(page.status,200);assert.ok(!html.includes('test-owner'));assert.ok(!html.includes('test-only-password'));db.close();});
test('authenticated updates require CSRF and same-origin checks; stale revisions cannot overwrite progress',async()=>{const db=setup(),cookie=await login(db);const res=await handleRequest(new Request(origin+'/api/state',{headers:{Cookie:cookie}}),env,db);const data=await res.json();assert.equal(data.state.tasks.length,144);data.state.notes='Private note';const put=(headers={},revision=data.revision)=>handleRequest(new Request(origin+'/api/state',{method:'PUT',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify({state:data.state,revision})}),env,db);assert.equal((await put()).status,403);assert.equal((await put({'X-CSRF-Token':data.csrfToken,Origin:'https://attacker.example'})).status,403);assert.equal((await put({'X-CSRF-Token':data.csrfToken})).status,200);assert.equal((await put({'X-CSRF-Token':data.csrfToken})).status,409);const latest=await(await handleRequest(new Request(origin+'/api/state',{headers:{Cookie:cookie}}),env,db)).json();assert.equal(latest.state.notes,'Private note');db.close();});
test('secure opaque cookies are HttpOnly and logout revokes the stored session',async()=>{const db=setup();const r=await handleRequest(new Request(origin+'/auth/login',{method:'POST',headers:{Origin:origin},body:'username=test-owner&password=test-only-password'}),env,db);const header=r.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);assert.match(header,/Secure/);const cookie=header.split(';')[0],data=await(await handleRequest(new Request(origin+'/api/state',{headers:{Cookie:cookie}}),env,db)).json();const out=await handleRequest(new Request(origin+'/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin,'X-CSRF-Token':data.csrfToken},body:'{}'}),env,db);assert.equal(out.status,200);assert.equal((await handleRequest(new Request(origin+'/api/state',{headers:{Cookie:cookie}}),env,db)).status,401);db.close();});
test('repeated failed logins are rate limited without revealing which field was wrong',async()=>{const db=setup();for(let i=0;i<5;i++){const res=await handleRequest(new Request(origin+'/auth/login',{method:'POST',headers:{Origin:origin},body:'username=test-owner&password=wrong'}),env,db,{clientKey:'test-ip'});assert.equal(res.status,401);}const blocked=await handleRequest(new Request(origin+'/auth/login',{method:'POST',headers:{Origin:origin},body:'username=test-owner&password=test-only-password'}),env,db,{clientKey:'test-ip'});assert.equal(blocked.status,429);assert.ok(blocked.headers.get('retry-after'));db.close();});
test('login response preserves the origin of a normal HTML form submission',async()=>{
 const db=setup();
 const page=await handleRequest(new Request(origin+'/login'),env,db);
 assert.equal(page.headers.get('referrer-policy'),'same-origin');
 assert.match(await page.text(),/method="post" action="\/auth\/login"/);
 // With this referrer policy the Fetch standard preserves the tuple origin
 // for a same-origin navigation POST instead of converting it to null.
 const submitted=await handleRequest(new Request(origin+'/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded','Sec-Fetch-Mode':'navigate','Sec-Fetch-Site':'same-origin'},body:'username=test-owner&password=test-only-password'}),env,db);
 assert.equal(submitted.status,303);assert.ok(submitted.headers.get('set-cookie'));
 db.close();
});
test('an explicitly configured public origin works through a proxy without trusting spoofed forwarding headers',async()=>{
 const db=setup(),internal='http://internal-worker:8080',settings={...env,PUBLIC_URL:origin};
 const request=(from,extra={})=>new Request(internal+'/auth/login',{method:'POST',headers:{...(from===undefined?{}:{Origin:from}),'Content-Type':'application/x-www-form-urlencoded',...extra},body:'username=test-owner&password=test-only-password'});
 const allowed=await handleRequest(request(origin),settings,db);assert.equal(allowed.status,303);assert.match(allowed.headers.get('set-cookie'),/Secure/);
 for(const from of [undefined,'null','https://attacker.example']){
  const rejected=await handleRequest(request(from,{'X-Forwarded-Host':'attacker.example','X-Forwarded-Proto':'https',Host:'attacker.example'}),settings,db);
  assert.equal(rejected.status,403);assert.equal(rejected.headers.get('set-cookie'),null);
 }
 db.close();
});

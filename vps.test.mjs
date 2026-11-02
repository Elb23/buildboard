import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pbkdf2Sync} from 'node:crypto';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
test('standalone VPS server runs without third-party dependencies and persists data across sessions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'buildboard-vps-test-')),salt='00112233445566778899aabbccddeeff';
 const child=spawn(process.execPath,['vps-server.mjs'],{cwd:root,env:{...process.env,APP_USERNAME:'test-owner',APP_PASSWORD_HASH:`pbkdf2-sha256:100000:${salt}:${pbkdf2Sync('test-only-password',Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex')}`,PUBLIC_URL:'',COOKIE_SECURE:'',HOST:'127.0.0.1',PORT:'0',DATABASE_PATH:join(dir,'board.sqlite')},stdio:['ignore','pipe','pipe']});
 try{
  const origin=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('VPS server startup timed out')),10000);child.stdout.on('data',chunk=>{const m=chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});child.once('exit',code=>{clearTimeout(timer);reject(new Error('VPS server exited early: '+code));});});
  const anon=await fetch(origin+'/api/plan');assert.equal(anon.status,401);
  const login=async()=>{const r=await fetch(origin+'/auth/login',{method:'POST',headers:{Origin:origin},body:new URLSearchParams({username:'test-owner',password:'test-only-password'}),redirect:'manual'});assert.equal(r.status,303);return r.headers.get('set-cookie').split(';')[0];};
  const first=await login(),data=await(await fetch(origin+'/api/state',{headers:{Cookie:first}})).json();assert.equal(data.state.tasks.length,144);data.state.notes='Portable persistence verified';
  const saved=await fetch(origin+'/api/state',{method:'PUT',headers:{Origin:origin,Cookie:first,'Content-Type':'application/json','X-CSRF-Token':data.csrfToken},body:JSON.stringify({state:data.state,revision:data.revision})});assert.equal(saved.status,200);
  const second=await login(),fresh=await(await fetch(origin+'/api/state',{headers:{Cookie:second}})).json();assert.equal(fresh.state.notes,'Portable persistence verified');
  const pdf=await fetch(origin+'/resources/engineering-plan.pdf',{headers:{Cookie:second}});assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');
 }finally{await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});await rm(dir,{recursive:true,force:true});}
});

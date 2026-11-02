import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {handleRequest} from './server/app.mjs';
import {openDatabase} from './server/sqlite-adapter.mjs';
const root=dirname(fileURLToPath(import.meta.url));
if(existsSync(join(root,'.env')))process.loadEnvFile(join(root,'.env'));
if(!process.env.APP_USERNAME||!process.env.APP_PASSWORD_HASH){console.error('Configure your private login first: npm run configure');process.exit(1);}
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
const db=openDatabase(process.env.DATABASE_PATH||join(root,'storage/buildboard.sqlite'),root);
const server=createServer(async(req,res)=>{try{
 const fallback=`http://${req.headers.host||'localhost:'+port}`;
 const origin=process.env.PUBLIC_URL?new URL(process.env.PUBLIC_URL).origin:fallback;
 if(process.env.PUBLIC_URL&&req.headers.host!==new URL(origin).host){res.writeHead(400,{'Content-Type':'text/plain'});return res.end('Invalid host. Use the configured public URL.');}
 const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value!==undefined&&key.toLowerCase()!=='x-forwarded-proto')headers.set(key,Array.isArray(value)?value.join(','):value);
 const init={method:req.method,headers};if(!['GET','HEAD'].includes(req.method)){init.body=req;init.duplex='half';}
 const request=new Request(new URL(req.url,origin),init);
 const result=await handleRequest(request,process.env,db,{clientKey:req.socket.remoteAddress||'local'});
 res.writeHead(result.status,Object.fromEntries(result.headers));
 if(!result.body)return res.end();const reader=result.body.getReader();for(;;){const {value,done}=await reader.read();if(done)break;res.write(Buffer.from(value));}res.end();
 }catch{if(!res.headersSent)res.writeHead(500,{'Content-Type':'text/plain'});res.end('The request could not be completed.');}});
server.requestTimeout=30000;server.headersTimeout=10000;server.maxHeadersCount=60;
server.listen(port,host,()=>console.log(`Buildboard is listening at http://${host}:${server.address().port}. Use your configured HTTPS domain for remote access.`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));

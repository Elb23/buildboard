import PLAN from '../data/plan.json' with {type:'json'};
import {initialState,normalizeState} from '../client/core.mjs';
import {SqlStore} from './store.mjs';
import {checkPassword,cookieValue,digest,equal,randomToken,sessionCookie,publicOrigin} from './auth.mjs';
import {ASSETS} from './generated-assets.mjs';

const MAX_BODY=2*1024*1024;
// `no-referrer` makes browsers send Origin: null for ordinary HTML POST forms.
// Keep the origin for our own forms while withholding referrers from other sites.
const SECURITY={'Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self' https://chatgpt.com; form-action 'self'"};
const response=(body,status=200,headers={})=>new Response(body,{status,headers:{...SECURITY,...headers}});
const json=(body,status=200,headers={})=>response(JSON.stringify(body),status,{'Content-Type':'application/json; charset=utf-8',...headers});
const redirect=(path,headers={})=>response(null,303,{Location:path,...headers});
async function bodyText(request){const reader=request.body?.getReader();if(!reader)return '';const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();throw Object.assign(new Error('The board is too large. Export a backup and shorten long notes.'),{status:413});}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder().decode(bytes);}
function loginPage(error=''){return ASSETS['/login.html'].body.replace('<!--LOGIN_ERROR-->',error?`<div class="login-error" role="alert">${error}</div>`:'');}
export async function handleRequest(request,env,db,{clientKey='local'}={}){
 try{
  const url=new URL(request.url),path=url.pathname,store=new SqlStore(db);
  if(!env.APP_USERNAME||!env.APP_PASSWORD_HASH)return response('This private board is not configured. Run the configuration command before starting it.',503,{'Content-Type':'text/plain; charset=utf-8'});
  const origin=publicOrigin(request,env);
  const secure=origin.startsWith('https:')||env.COOKIE_SECURE==='1';
  const stateChange=!['GET','HEAD','OPTIONS'].includes(request.method);
  if(stateChange&&request.headers.get('origin')!==origin){
   if(path==='/auth/login')return response(loginPage('Please reopen the sign-in page and try again.'),403,{'Content-Type':'text/html; charset=utf-8'});
   return json({error:'This request must come from your own board.'},403);
  }
  if(path==='/auth/login'&&request.method==='POST'){
   const clientLimit='client:'+await digest(clientKey),globalLimit='account';const now=Date.now();
   const limits=await Promise.all([store.limit(clientLimit),store.limit(globalLimit)]);
   const blocked=limits.find(v=>v&&v.reset_at>now&&v.attempts>=5);
   if(blocked)return response(loginPage('Too many attempts. Please try again in 15 minutes.'),429,{'Content-Type':'text/html; charset=utf-8','Retry-After':String(Math.ceil((blocked.reset_at-now)/1000))});
   const text=await bodyText(request);if(text.length>4096)return json({error:'Invalid login request.'},400);
   const form=new URLSearchParams(text),username=String(form.get('username')||''),password=String(form.get('password')||'');
   const validPassword=await checkPassword(password,env.APP_PASSWORD_HASH);
   const validUsername=equal(await digest(username),await digest(env.APP_USERNAME));
   if(!validPassword||!validUsername){await store.failure(clientLimit,now);await store.failure(globalLimit,now);return response(loginPage('The login or password is incorrect.'),401,{'Content-Type':'text/html; charset=utf-8'});}
   await store.clearLimit(clientLimit);await store.clearLimit(globalLimit);
   const token=randomToken(),csrf=randomToken();await store.createSession(await digest(token),csrf,now+28800000);
   return redirect('/',{'Set-Cookie':sessionCookie(token,secure)});
  }
  const token=cookieValue(request);const session=/^[a-f0-9]{64}$/.test(token)?await store.session(await digest(token)):null;
  const authenticated=session&&session.expires_at>Date.now();
  if(path==='/login'&&request.method==='GET')return authenticated?redirect('/'):response(loginPage(),200,{'Content-Type':'text/html; charset=utf-8'});
  if(!authenticated)return path.startsWith('/api/')?json({error:'Please sign in to continue.'},401):redirect('/login');
  if(stateChange&&!equal(request.headers.get('x-csrf-token')||'',session.csrf))return json({error:'Your session changed. Reload before saving.'},403);
  if(path==='/auth/logout'&&request.method==='POST'){await store.deleteSession(await digest(token));return json({ok:true},200,{'Set-Cookie':sessionCookie('',secure,true)});}
  if(path==='/api/plan'&&request.method==='GET')return json(PLAN);
  if(path==='/api/state'&&request.method==='GET'){
   const row=await store.document()||await store.initialize(initialState(PLAN));return json({state:normalizeState(JSON.parse(row.body),PLAN),revision:row.revision,csrfToken:session.csrf});
  }
  if(path==='/api/state'&&request.method==='PUT'){
   if(!(request.headers.get('content-type')||'').startsWith('application/json'))return json({error:'Use JSON for board updates.'},415);
   let payload;try{payload=JSON.parse(await bodyText(request));}catch(error){if(error.status)throw error;return json({error:'The board update was not valid JSON.'},400);}
   if(!Number.isInteger(payload.revision)||payload.revision<1)return json({error:'A saved revision is required.'},400);
   let next;try{next=normalizeState(payload.state,PLAN);}catch(error){return json({error:error.message},422);}
   if(!await store.save(next,payload.revision))return json({error:'A newer copy was saved from another tab or device. Export your unsaved changes, then reload the latest board.',conflict:true},409);
   return json({revision:payload.revision+1});
  }
  if(!['GET','HEAD'].includes(request.method))return json({error:'This action is not available.'},405);
  const key=path==='/'?'/index.html':path;const asset=ASSETS[key];
  if(!asset)return response('Page not found.',404,{'Content-Type':'text/plain; charset=utf-8'});
  const body=asset.base64?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;
  return response(request.method==='HEAD'?null:body,200,{'Content-Type':asset.type,...(asset.type==='application/pdf'?{'Content-Disposition':`inline; filename="${path.split('/').pop()}"`}:{})});
 }catch(error){if(error.status)return json({error:error.message},error.status);console.error('Buildboard request failed:',error?.name||'Error');return json({error:'The board could not complete this request. Your saved data has not been replaced.'},500);}
}

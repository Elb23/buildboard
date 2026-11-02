const encoder=new TextEncoder();
export const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
export function equal(a,b){if(a.length!==b.length)return false;let value=0;for(let i=0;i<a.length;i++)value|=a.charCodeAt(i)^b.charCodeAt(i);return value===0;}
export async function checkPassword(password,encoded){
 const parts=String(encoded||'').split(':');if(parts.length!==4||parts[0]!=='pbkdf2-sha256'||parts[1]!=='100000'||!/^[a-f0-9]{32}$/.test(parts[2])||!/^[a-f0-9]{64}$/.test(parts[3]))throw new Error('Authentication is not configured.');
 const salt=Uint8Array.from(parts[2].match(/../g),b=>parseInt(b,16));
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const result=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},key,256);
 return equal(hex(result),parts[3]);
}
export function cookieValue(request){const cookies=request.headers.get('cookie')||'';const found=cookies.split(';').map(s=>s.trim()).find(s=>s.startsWith('buildboard_session='));return found?.slice('buildboard_session='.length)||'';}
export function sessionCookie(token,secure,clear=false){return `buildboard_session=${clear?'':token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:28800}${secure?'; Secure':''}`;}
export function publicOrigin(request,env){
 const url=new URL(env.PUBLIC_URL||request.url);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid public origin configuration.');
 // The public address is server configuration. Forwarded/Host/Origin request
 // headers must never choose the origin that a state-changing request trusts.
 return url.origin;
}

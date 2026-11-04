export type GoogleOwnerConfig={DPA_GOOGLE_CLIENT_ID?:string;DPA_OWNER_EMAIL?:string};
type GoogleJwk=JsonWebKey&{kid:string};
let cached:{keys:GoogleJwk[];expires:number}|null=null;
const encoder=new TextEncoder();
export function googleOwnerConfig(env:GoogleOwnerConfig){
 const clientId=env.DPA_GOOGLE_CLIENT_ID?.trim()||'',email=env.DPA_OWNER_EMAIL?.trim().toLowerCase()||'';
 return /^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)&&/^[^\s@]+@gmail\.com$/.test(email)?{clientId,email}:null;
}
function bytes(value:string){
 if(!/^[a-zA-Z0-9_-]+$/.test(value))throw Error('Invalid base64url');
 const base64=value.replace(/-/g,'+').replace(/_/g,'/');
 return Uint8Array.from(atob(base64+'='.repeat((4-base64.length%4)%4)),c=>c.charCodeAt(0));
}
function json(value:string){return JSON.parse(new TextDecoder().decode(bytes(value)));}
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function digest(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
async function keys(fetcher:typeof fetch){
 // Workers rejects redirect:'error' before sending a request. Manual mode
 // keeps the pinned Google endpoint and rejects redirects via the status check.
 const response=await fetcher('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000),redirect:'manual'});
 if(!response.ok)throw Error('Google certificates unavailable');
 const data=await response.json() as {keys:GoogleJwk[]};
 if(!Array.isArray(data.keys)||data.keys.length>10)throw Error('Invalid Google certificate response');
 const maxAge=Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||300);
 cached={keys:data.keys,expires:Date.now()+Math.max(60,Math.min(maxAge,3600))*1000};return cached.keys;
}
export type GoogleOwnerFailure='GOOGLE_TOKEN_INVALID'|'GOOGLE_CLIENT_MISMATCH'|'GOOGLE_TOKEN_EXPIRED'|'GOOGLE_NONCE_MISMATCH'|'GOOGLE_EMAIL_UNVERIFIED'|'GOOGLE_EMAIL_MISMATCH'|'GOOGLE_CERTS_UNAVAILABLE'|'GOOGLE_KEY_UNAVAILABLE'|'GOOGLE_KEY_IMPORT_FAILED'|'GOOGLE_SIGNATURE_INVALID';
export type GoogleOwnerCheck={ok:true;identity:{sub:string;email:string}}|{ok:false;code:GoogleOwnerFailure;verifiedEmail?:string};
export async function checkGoogleOwnerKeys(fetcher:typeof fetch=fetch):Promise<{ok:true}|{ok:false;code:GoogleOwnerFailure}>{
 let available:GoogleJwk[];
 try{available=cached&&cached.expires>Date.now()?cached.keys:await keys(fetcher);}catch{return {ok:false,code:'GOOGLE_CERTS_UNAVAILABLE'};}
 const jwk=available.find(k=>k.kty==='RSA'&&k.alg==='RS256'&&k.use==='sig');
 if(!jwk)return {ok:false,code:'GOOGLE_KEY_UNAVAILABLE'};
 try{await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);return {ok:true};}
 catch{return {ok:false,code:'GOOGLE_KEY_IMPORT_FAILED'};}
}
// Verify only Google's pinned public-key endpoint; never trust a JWT-supplied jku/x5u URL.
export async function checkGoogleOwnerToken(token:string,config:{clientId:string;email:string},nonceHash:string,fetcher:typeof fetch=fetch):Promise<GoogleOwnerCheck>{
 const fail=(code:GoogleOwnerFailure):GoogleOwnerCheck=>({ok:false,code});
 try{
  if(token.length>7000)return fail('GOOGLE_TOKEN_INVALID');const parts=token.split('.');if(parts.length!==3)return fail('GOOGLE_TOKEN_INVALID');
  const header=json(parts[0]),claims=json(parts[1]),now=Math.floor(Date.now()/1000);
  if(!header||!claims||header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>128||header.crit)return fail('GOOGLE_TOKEN_INVALID');
  if(!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||claims.aud!==config.clientId||(claims.azp&&claims.azp!==config.clientId))return fail('GOOGLE_CLIENT_MISMATCH');
  if(!Number.isInteger(claims.exp)||claims.exp<=now||!Number.isInteger(claims.iat)||claims.iat>now+60||claims.iat<now-7200||claims.exp<=claims.iat)return fail('GOOGLE_TOKEN_EXPIRED');
  if(typeof claims.nonce!=='string'||claims.nonce.length>128||await digest(claims.nonce)!==nonceHash)return fail('GOOGLE_NONCE_MISMATCH');
  let available:GoogleJwk[];
  try{available=cached&&cached.expires>Date.now()?cached.keys:await keys(fetcher);}catch{return fail('GOOGLE_CERTS_UNAVAILABLE');}
  let jwk=available.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.alg==='RS256'&&k.use==='sig');
  if(!jwk){try{available=await keys(fetcher);}catch{return fail('GOOGLE_CERTS_UNAVAILABLE');}jwk=available.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.alg==='RS256'&&k.use==='sig');}
  if(!jwk)return fail('GOOGLE_KEY_UNAVAILABLE');
  let key:CryptoKey;
  try{key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);}catch{return fail('GOOGLE_KEY_IMPORT_FAILED');}
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),encoder.encode(parts[0]+'.'+parts[1])))return fail('GOOGLE_SIGNATURE_INVALID');
  if(claims.email_verified!==true||typeof claims.email!=='string'||typeof claims.sub!=='string'||!/^[a-zA-Z0-9_-]{1,255}$/.test(claims.sub))return fail('GOOGLE_EMAIL_UNVERIFIED');
  if(claims.email.toLowerCase()!==config.email)return {ok:false,code:'GOOGLE_EMAIL_MISMATCH',verifiedEmail:claims.email};
  return {ok:true,identity:{sub:claims.sub,email:config.email}};
 }catch{return fail('GOOGLE_TOKEN_INVALID');}
}
export async function verifyGoogleOwnerToken(token:string,config:{clientId:string;email:string},nonceHash:string,fetcher:typeof fetch=fetch){
 const result=await checkGoogleOwnerToken(token,config,nonceHash,fetcher);return result.ok?result.identity:null;
}

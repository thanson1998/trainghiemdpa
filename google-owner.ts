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
 return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
}
function json(value:string){return JSON.parse(new TextDecoder().decode(bytes(value)));}
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function digest(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
async function keys(fetcher:typeof fetch){
 const response=await fetcher('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!response.ok)throw Error('Google certificates unavailable');
 const data=await response.json() as {keys:GoogleJwk[]};
 if(!Array.isArray(data.keys)||data.keys.length>10)throw Error('Invalid Google certificate response');
 const maxAge=Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||300);
 cached={keys:data.keys,expires:Date.now()+Math.max(60,Math.min(maxAge,3600))*1000};return cached.keys;
}
// Verify only Google's pinned public-key endpoint; never trust a JWT-supplied jku/x5u URL.
export async function verifyGoogleOwnerToken(token:string,config:{clientId:string;email:string},nonceHash:string,fetcher:typeof fetch=fetch):Promise<{sub:string;email:string}|null>{
 try{
  if(token.length>7000)return null;const parts=token.split('.');if(parts.length!==3)return null;
  const header=json(parts[0]),claims=json(parts[1]),now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>128||header.crit)return null;
  if(!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||claims.aud!==config.clientId||(claims.azp&&claims.azp!==config.clientId))return null;
  if(!Number.isInteger(claims.exp)||claims.exp<=now||!Number.isInteger(claims.iat)||claims.iat>now+60||claims.iat<now-7200||claims.exp<=claims.iat)return null;
  if(claims.email_verified!==true||typeof claims.email!=='string'||claims.email.toLowerCase()!==config.email||typeof claims.sub!=='string'||!/^[a-zA-Z0-9_-]{1,255}$/.test(claims.sub))return null;
  if(typeof claims.nonce!=='string'||claims.nonce.length>128||await digest(claims.nonce)!==nonceHash)return null;
  let available=cached&&cached.expires>Date.now()?cached.keys:await keys(fetcher);
  let jwk=available.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.alg==='RS256'&&k.use==='sig');
  if(!jwk){available=await keys(fetcher);jwk=available.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.alg==='RS256'&&k.use==='sig');}
  if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),encoder.encode(parts[0]+'.'+parts[1])))return null;
  return {sub:claims.sub,email:config.email};
 }catch{return null;}
}

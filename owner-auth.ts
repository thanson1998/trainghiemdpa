import {googleOwnerConfig,checkGoogleOwnerToken,checkGoogleOwnerKeys,type GoogleOwnerConfig,type GoogleOwnerFailure} from './google-owner';
export interface OwnerAuthEnv extends GoogleOwnerConfig {DB:D1Database;DPA_OWNER_SETUP_KEY?:string;DPA_OWNER_PASSWORD?:string;DPA_OWNER_USERNAME?:string}
export type OwnerIdentity={username:string;role:'owner';passwordEnabled:boolean};
type Account={username:string;password_hash:string;version:number;google_subject?:string|null};
export const ownerSessionSeconds=12*60*60;
const iterations=100000; // Workers WebCrypto caps each PBKDF2 derivation at 100,000.
const encoder=new TextEncoder();
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
async function digest(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
function equal(a:string,b:string){let mismatch=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)mismatch|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return mismatch===0;}
export async function hashOwnerPassword(password:string){
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);
 return `pbkdf2-sha256$${iterations}$${hex(salt)}$${hex(new Uint8Array(bits))}`;
}
export async function verifyOwnerPassword(password:string,stored:string){
 const [scheme,count,salt,expected]=stored.split('$');
 if(scheme!=='pbkdf2-sha256'||Number(count)!==iterations||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(expected))return false;
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:Uint8Array.from(salt.match(/../g)!,h=>parseInt(h,16)),iterations},key,256);
 return equal(hex(new Uint8Array(bits)),expected);
}
const out=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function readAuthBody(request:Request){
 const reader=request.body?.getReader();if(!reader)return '';
 const decoder=new TextDecoder();let bytes=0,raw='';
 while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>8192){await reader.cancel();return null;}raw+=decoder.decode(chunk.value,{stream:true});}
 return raw+decoder.decode();
}
function tokenFrom(request:Request){const match=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/);return match?.[1];}
export async function requireOwner(request:Request,env:OwnerAuthEnv):Promise<OwnerIdentity|null>{
 const token=tokenFrom(request);if(!token)return null;
 const row=await env.DB.prepare('SELECT a.username,a.password_hash FROM owner_sessions s JOIN owner_account a ON a.id=1 AND a.version=s.account_version WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Math.floor(Date.now()/1000)).first<{username:string;password_hash:string}>();
 return row?{username:row.username,role:'owner',passwordEnabled:!!row.password_hash}:null;
}
async function limited(request:Request,env:OwnerAuthEnv,scope:string,limit:number,seconds:number){
 const now=Math.floor(Date.now()/1000),window=Math.floor(now/seconds),ip=request.headers.get('CF-Connecting-IP')||'local';
 // The edge-provided address, never X-Forwarded-For. A global bound also limits distributed guessing.
 const ipKey=await digest(ip);
 for(const [key,max] of [[`${scope}:ip:${ipKey}:${window}`,limit],[`${scope}:global:${window}`,limit*10]] as const){
  const row=await env.DB.prepare('INSERT INTO owner_auth_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(key,(window+1)*seconds).first<{attempts:number}>();
  if(!row||row.attempts>max)return true;
 }
 await env.DB.prepare('DELETE FROM owner_auth_limits WHERE expires_at<=?').bind(now).run();
 return false;
}
function credentials(input:any){return typeof input?.username==='string'&&/^[a-zA-Z0-9_.-]{3,64}$/.test(input.username)&&typeof input.password==='string'&&input.password.length>=12&&input.password.length<=128;}
function initialPasswordConfig(env:OwnerAuthEnv){
 const username=env.DPA_OWNER_USERNAME?.trim().toLowerCase()||'thanson198',password=env.DPA_OWNER_PASSWORD;
 return /^[a-zA-Z0-9_.-]{3,64}$/.test(username)&&typeof password==='string'&&password.length>=8&&password.length<=128?{username,password}:null;
}
async function validSetupKey(input:any,env:OwnerAuthEnv){
 const configured=env.DPA_OWNER_SETUP_KEY?.trim();
 return !!configured&&configured.length>=32&&typeof input.setupKey==='string'&&input.setupKey.length<=512&&equal(await digest(input.setupKey),await digest(configured));
}
async function issueSession(env:OwnerAuthEnv,account:Account){
 const token=random(),now=Math.floor(Date.now()/1000),expiresAt=now+ownerSessionSeconds;
 // Conditional insert prevents a login racing a password change from issuing a usable old session.
 const result=await env.DB.prepare('INSERT INTO owner_sessions(token_hash,account_version,expires_at,created_at) SELECT ?,?,?,? FROM owner_account WHERE id=1 AND version=?').bind(await digest(token),account.version,expiresAt,now,account.version).run();
 if(!result.meta.changes)return out({error:'Tài khoản vừa thay đổi. Vui lòng đăng nhập lại.'},409);
 await env.DB.prepare('DELETE FROM owner_sessions WHERE expires_at<=?').bind(now).run();
 return out({user:{username:account.username,role:'owner',passwordEnabled:!!account.password_hash},token,expiresAt:expiresAt*1000});
}
export async function ownerAuthRoute(request:Request,env:OwnerAuthEnv):Promise<Response>{
 const path=new URL(request.url).pathname;
 try{
  if(path==='/api/auth/status'&&request.method==='GET'){
   const exists=await env.DB.prepare('SELECT password_hash FROM owner_account WHERE id=1').first<{password_hash:string}>();
   return out({configured:!!exists,setupAvailable:(env.DPA_OWNER_SETUP_KEY?.trim().length??0)>=32,googleClientId:googleOwnerConfig(env)?.clientId??null,passwordLoginAvailable:!!exists?.password_hash||!!initialPasswordConfig(env)});
  }
  if(path==='/api/auth/me'&&request.method==='GET'){
   const user=await requireOwner(request,env);return user?out({user}):out({error:'Vui lòng đăng nhập tài khoản Chủ quán.'},401);
  }
  if(path==='/api/auth/google/health'&&request.method==='GET'){
   if(!googleOwnerConfig(env))return out({ok:false,code:'GOOGLE_NOT_CONFIGURED'},503);
   if(await limited(request,env,'google-health',6,900))return out({error:'Thử kiểm tra lại sau ít phút.'},429);
   const result=await checkGoogleOwnerKeys();return out(result,result.ok?200:503);
  }
  if(!['/api/auth/setup','/api/auth/login','/api/auth/logout','/api/auth/password','/api/auth/recover','/api/auth/google/challenge','/api/auth/google'].includes(path))return out({error:'Không tìm thấy chức năng.'},404);
  if(request.method!=='POST')return out({error:'Chỉ hỗ trợ POST.'},405);
  if(!request.headers.get('Content-Type')?.toLowerCase().includes('application/json'))return out({error:'Yêu cầu phải là JSON.'},415);
  const raw=await readAuthBody(request);if(raw===null)return out({error:'Thông tin quá dài.'},413);
  let input:any;try{input=JSON.parse(raw);}catch{return out({error:'Thông tin không hợp lệ.'},400);}
  if(!input||typeof input!=='object'||Array.isArray(input))return out({error:'Thông tin không hợp lệ.'},400);
  if(path.startsWith('/api/auth/google')){
   const config=googleOwnerConfig(env);if(!config)return out({error:'Chưa cấu hình Gmail Chủ quán và Google Client ID trên Cloudflare.'},503);
   const challenge=path==='/api/auth/google/challenge';
   if(await limited(request,env,challenge?'google-challenge':'google-login',challenge?60:10,challenge?3600:900))return out({error:'Đã thử quá nhiều lần. Vui lòng thử lại sau.'},429);
   const now=Math.floor(Date.now()/1000);
   if(challenge){
    const id=random(),nonce=random();await env.DB.prepare('DELETE FROM owner_google_challenges WHERE expires_at<=?').bind(now).run();
    await env.DB.prepare('INSERT INTO owner_google_challenges(id_hash,nonce_hash,expires_at) VALUES(?,?,?)').bind(await digest(id),await digest(nonce),now+300).run();
    return out({challenge:id,nonce});
   }
   if(typeof input.credential!=='string'||typeof input.challenge!=='string'||!/^[a-f0-9]{64}$/.test(input.challenge))return out({error:'Thông tin đăng nhập Google không hợp lệ.'},400);
   const idHash=await digest(input.challenge),stored=await env.DB.prepare('SELECT nonce_hash FROM owner_google_challenges WHERE id_hash=? AND expires_at>?').bind(idHash,now).first<{nonce_hash:string}>();
   if(!stored)return out({error:'Lượt đăng nhập Google đã hết hạn. Hãy thử lại.'},401);
   const checked=await checkGoogleOwnerToken(input.credential,config,stored.nonce_hash);
   if(!checked.ok){
    const messages:Record<GoogleOwnerFailure,string>={
     GOOGLE_EMAIL_MISMATCH:'Gmail Google vừa xác minh không trùng với Gmail Chủ quán. Chọn lại tài khoản hoặc kiểm tra giá trị DPA_OWNER_EMAIL trên Cloudflare.',
     GOOGLE_EMAIL_UNVERIFIED:'Google chưa xác minh được địa chỉ Gmail này. Hãy dùng tài khoản Gmail đã xác minh.',
     GOOGLE_CLIENT_MISMATCH:'Google Client ID không khớp với máy chủ DPA. Tải lại trang và kiểm tra cấu hình Google Client ID trên Cloudflare.',
     GOOGLE_TOKEN_EXPIRED:'Thông tin đăng nhập Google đã hết hạn hoặc thời gian không khớp. Bấm Thử lại Google để lấy lượt mới.',
     GOOGLE_NONCE_MISMATCH:'Lượt xác thực Google không khớp với trang đang mở. Bấm Thử lại Google rồi đăng nhập lại.',
     GOOGLE_CERTS_UNAVAILABLE:'Máy chủ DPA chưa tải được khóa xác thực từ Google. Hãy thử lại sau ít phút.',
     GOOGLE_KEY_UNAVAILABLE:'Google đang thay đổi khóa xác thực. Bấm Thử lại Google để lấy thông tin mới.',
     GOOGLE_KEY_IMPORT_FAILED:'Máy chủ chưa đọc được khóa xác thực Google. Cần kiểm tra khả năng xác thực của máy chủ.',
     GOOGLE_SIGNATURE_INVALID:'Chữ ký đăng nhập Google không hợp lệ. Bấm Thử lại Google; hệ thống chưa cấp quyền truy cập.',
     GOOGLE_TOKEN_INVALID:'Thông tin đăng nhập Google không hợp lệ. Bấm Thử lại Google.'
    };
    const infrastructure=['GOOGLE_CERTS_UNAVAILABLE','GOOGLE_KEY_UNAVAILABLE','GOOGLE_KEY_IMPORT_FAILED'].includes(checked.code);
    return out({error:messages[checked.code]+(checked.verifiedEmail?' Gmail vừa chọn: '+checked.verifiedEmail+'.':'')+' ('+checked.code+')',code:checked.code},infrastructure?503:403);
   }
   const identity=checked.identity;
   const consumed=await env.DB.prepare('DELETE FROM owner_google_challenges WHERE id_hash=? AND expires_at>? RETURNING nonce_hash').bind(idHash,Math.floor(Date.now()/1000)).first();
   if(!consumed)return out({error:'Lượt đăng nhập này đã được sử dụng. Hãy thử lại.'},401);
   await env.DB.prepare("INSERT INTO owner_account(id,username,password_hash,version,updated_at,google_subject) VALUES(1,'owner','',1,?,?) ON CONFLICT(id) DO NOTHING").bind(new Date().toISOString(),identity.sub).run();
   await env.DB.prepare('UPDATE owner_account SET google_subject=?,updated_at=? WHERE id=1 AND (google_subject IS NULL OR google_subject=?)').bind(identity.sub,new Date().toISOString(),identity.sub).run();
   const account=await env.DB.prepare('SELECT username,password_hash,version,google_subject FROM owner_account WHERE id=1').first<Account>();
   if(!account||account.google_subject!==identity.sub)return out({error:'Tài khoản Chủ quán đã liên kết với Google khác. Kiểm tra lại cấu hình.'},403);
   return issueSession(env,account);
  }
  if(path==='/api/auth/logout'){
   const token=tokenFrom(request);if(token)await env.DB.prepare('DELETE FROM owner_sessions WHERE token_hash=?').bind(await digest(token)).run();
   return out({ok:true});
  }
  if(path==='/api/auth/password'){
   const user=await requireOwner(request,env);if(!user)return out({error:'Phiên đăng nhập đã hết hạn.'},401);
   if(await limited(request,env,'password',8,900))return out({error:'Đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.'},429);
   if(typeof input.currentPassword!=='string'||input.currentPassword.length>128||typeof input.password!=='string'||input.password.length<12||input.password.length>128)return out({error:'Mật khẩu mới phải có từ 12 đến 128 ký tự.'},400);
   const account=await env.DB.prepare('SELECT username,password_hash,version FROM owner_account WHERE id=1').first<Account>();
   if(!account||!await verifyOwnerPassword(input.currentPassword,account.password_hash))return out({error:'Mật khẩu hiện tại không đúng.'},400);
   const changed=await env.DB.prepare('UPDATE owner_account SET password_hash=?,version=version+1,updated_at=? WHERE id=1 AND version=?').bind(await hashOwnerPassword(input.password),new Date().toISOString(),account.version).run();
   if(!changed.meta.changes)return out({error:'Tài khoản vừa thay đổi. Đăng nhập lại để tiếp tục.'},409);
   // version invalidates all sessions atomically, including this device.
   return out({ok:true,loginRequired:true});
  }
  const recovery=path==='/api/auth/recover',setup=path==='/api/auth/setup';
  if(await limited(request,env,setup||recovery?'setup':'login',setup||recovery?6:10,900))return out({error:'Đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.'},429);
  if(setup||recovery){
   if(!await validSetupKey(input,env))return out({error:'Mã thiết lập không đúng hoặc chưa được cấu hình trên máy chủ.'},403);
   if(!credentials(input))return out({error:'Tên đăng nhập gồm 3–64 chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang; mật khẩu gồm 12–128 ký tự.'},400);
   if(setup){
    const inserted=await env.DB.prepare('INSERT INTO owner_account(id,username,password_hash,version,updated_at) VALUES(1,?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(input.username.toLowerCase(),await hashOwnerPassword(input.password),new Date().toISOString()).run();
    if(!inserted.meta.changes)return out({error:'Tài khoản Chủ quán đã được thiết lập. Hãy đăng nhập.'},409);
   }else{
    const changed=await env.DB.prepare('UPDATE owner_account SET username=?,password_hash=?,version=version+1,updated_at=? WHERE id=1').bind(input.username.toLowerCase(),await hashOwnerPassword(input.password),new Date().toISOString()).run();
    if(!changed.meta.changes)return out({error:'Chưa có tài khoản. Hãy thiết lập lần đầu.'},409);
   }
   return out({ok:true,loginRequired:true});
  }
  if(typeof input.username!=='string'||input.username.length>64||typeof input.password!=='string'||input.password.length>128)return out({error:'Tên đăng nhập hoặc mật khẩu không đúng.'},401);
  let account=await env.DB.prepare('SELECT username,password_hash,version FROM owner_account WHERE id=1').first<Account>();
  if(!account?.password_hash){
   const initial=initialPasswordConfig(env);
   if(!initial)return out({error:'Chưa thiết lập mật khẩu Chủ quán. Thêm Secret DPA_OWNER_PASSWORD trên Cloudflare trước khi đăng nhập bằng ID.',code:'OWNER_PASSWORD_NOT_CONFIGURED'},503);
   if(input.username.toLowerCase()!==initial.username||!equal(await digest(input.password),await digest(initial.password)))return out({error:'Tên đăng nhập hoặc mật khẩu không đúng.'},401);
   // A private runtime secret may initialize the only owner, but can never reset an existing password.
   await env.DB.prepare(`INSERT INTO owner_account(id,username,password_hash,version,updated_at) VALUES(1,?,?,1,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash,version=owner_account.version+1,updated_at=excluded.updated_at WHERE owner_account.password_hash=''`).bind(initial.username,await hashOwnerPassword(input.password),new Date().toISOString()).run();
   account=await env.DB.prepare('SELECT username,password_hash,version FROM owner_account WHERE id=1').first<Account>();
  }
  // Dummy derivation keeps the account-not-found and invalid-username paths comparable.
  const valid=await verifyOwnerPassword(input.password,account?.password_hash??`pbkdf2-sha256$${iterations}$${'0'.repeat(32)}$${'0'.repeat(64)}`);
  if(!account||!valid||input.username.toLowerCase()!==account.username)return out({error:'Tên đăng nhập hoặc mật khẩu không đúng.'},401);
  return issueSession(env,account);
 }catch{return out({error:'Chưa sử dụng được đăng nhập. Kiểm tra kết nối và bản cập nhật máy chủ.'},503);}
}

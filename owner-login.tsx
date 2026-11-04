import {GoogleOwnerButton,type OwnerLoginResult} from './google-owner-button';
import {createContext,useContext,useState,useEffect,useCallback,useRef,type ReactNode,type FormEvent} from 'react';
import {LockKeyhole,LogOut,KeyRound,Leaf,RefreshCw,X,ShieldCheck} from 'lucide-react';
import {apiRequest,apiOrigin} from './sync';
import {ownerToken,saveOwnerSession,clearOwnerSession} from './auth-session';
import {invalidatePendingReads} from './request-pool';
import './owner-login.css';
type User={username:string;role:'owner';passwordEnabled:boolean};
type AuthReply={error?:string;configured:boolean;setupAvailable:boolean;googleClientId:string|null;user:User;token:string;expiresAt:number};
const OwnerContext=createContext<{user:User;logout:()=>Promise<void>;changePassword:()=>void}|null>(null);
export function OwnerControls(){
 const owner=useContext(OwnerContext);if(!owner)return null;
 return <div className="owner-controls"><div className="owner-identity"><ShieldCheck size={19}/><span><b>{owner.user.username}</b><small>Chủ quán · Toàn quyền</small></span></div><div className="owner-buttons">{owner.user.passwordEnabled&&<button type="button" onClick={owner.changePassword}><KeyRound size={15}/>Đổi mật khẩu</button>}<button type="button" onClick={()=>void owner.logout()}><LogOut size={15}/>Đăng xuất</button></div></div>;
}
export function OwnerGate({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[available,setAvailable]=useState(false),[configured,setConfigured]=useState(true),[setupAvailable,setSetupAvailable]=useState(false);
 const [mode,setMode]=useState<'login'|'setup'|'recover'>('login'),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[passwordOpen,setPasswordOpen]=useState(false);
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[setupKey,setSetupKey]=useState('');
 const [oldPassword,setOldPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[newConfirm,setNewConfirm]=useState(''),[passwordError,setPasswordError]=useState('');
 const [googleClientId,setGoogleClientId]=useState(''),[showPassword,setShowPassword]=useState(false);
 const sequence=useRef(0),working=useRef(false),dialog=useRef<HTMLDivElement>(null);
 const resetFields=()=>{setPassword('');setConfirm('');setSetupKey('');};
 const check=useCallback(async()=>{
  const seq=++sequence.current;setError('');
  try{
   const r=await apiRequest('/api/auth/status'),data=await r.json() as AuthReply;if(!r.ok)throw Error(data.error||'Chưa kết nối được máy chủ.');if(seq!==sequence.current)return;
   setAvailable(true);setConfigured(data.configured);setSetupAvailable(data.setupAvailable);setGoogleClientId(data.googleClientId||'');if(!data.configured&&!data.googleClientId)setMode('setup');else setMode('login');
   if(ownerToken(apiOrigin())){const me=await apiRequest('/api/auth/me'),body=await me.json() as AuthReply;if(seq!==sequence.current)return;if(me.ok)setUser(body.user);else if(me.status!==401)throw Error(body.error||'Chưa kiểm tra được phiên đăng nhập.');}
  }catch(e){if(seq===sequence.current){setAvailable(false);setError((e as Error).message);}}finally{if(seq===sequence.current)setLoading(false);}
 },[]);
 useEffect(()=>{void check();return()=>{sequence.current++;};},[check]);
 useEffect(()=>{
  const ended=()=>{sequence.current++;invalidatePendingReads();setUser(null);setLoading(false);setPasswordOpen(false);setMessage('Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập để tiếp tục.');};
  window.addEventListener('dpa-owner-session-ended',ended);return()=>window.removeEventListener('dpa-owner-session-ended',ended);
 },[]);
 useEffect(()=>{
  if(!user)return;
  let active=true;const validate=async()=>{if(document.hidden)return;try{await apiRequest('/api/auth/me');}catch{ /* A network outage must not discard unsaved orders. */ }};
  const timer=setInterval(()=>{if(active)void validate();},60000);const focus=()=>void validate();window.addEventListener('focus',focus);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',focus);};
 },[user]);
 useEffect(()=>{
  if(!passwordOpen)return;const previous=document.activeElement as HTMLElement,old=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!working.current)setPasswordOpen(false);if(e.key==='Tab'){
   const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')??[]),first=controls[0],last=controls.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }};window.addEventListener('keydown',key);return()=>{document.body.style.overflow=old;window.removeEventListener('keydown',key);previous?.focus();};
 },[passwordOpen]);
 async function logout(){
  if(working.current)return;working.current=true;
  let warning='';
  try{const r=await apiRequest('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error('Không kết nối được máy chủ.');}
  catch{warning='Đã khóa trên thiết bị này. Chưa xác nhận được thu hồi phiên trên máy chủ do lỗi kết nối; phiên sẽ tự hết hạn.';}
  finally{clearOwnerSession();resetFields();if(warning)setMessage(warning);working.current=false;try{window.google?.accounts?.id?.disableAutoSelect();}catch{}}
 }
 function googleSuccess(data:OwnerLoginResult){
  if(working.current)return;saveOwnerSession({token:data.token,expiresAt:data.expiresAt,origin:apiOrigin()});invalidatePendingReads();setUser(data.user);resetFields();setError('');setMessage('');
 }
 async function submit(e:FormEvent){
  e.preventDefault();if(working.current)return;setError('');setMessage('');
  if(mode!=='login'&&password!==confirm){setError('Hai mật khẩu chưa trùng nhau.');return;}
  working.current=true;setBusy(true);
  try{
   const r=await apiRequest('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,...(mode==='login'?{}:{setupKey})})}),data=await r.json() as AuthReply;
   if(!r.ok)throw Error(data.error||'Chưa đăng nhập được.');
   if(mode==='login'){saveOwnerSession({token:data.token,expiresAt:data.expiresAt,origin:apiOrigin()});invalidatePendingReads();setUser(data.user);}
   else{setConfigured(true);setMode('login');setMessage('Đã lưu tài khoản Chủ quán. Hãy đăng nhập bằng mật khẩu vừa đặt.');}
   resetFields();
  }catch(e){setError((e as Error).message);}finally{working.current=false;setBusy(false);}
 }
 async function changePassword(e:FormEvent){
  e.preventDefault();if(working.current)return;setPasswordError('');if(newPassword!==newConfirm){setPasswordError('Hai mật khẩu mới chưa trùng nhau.');return;}
  working.current=true;setBusy(true);
  try{const r=await apiRequest('/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:oldPassword,password:newPassword})}),data=await r.json() as AuthReply;if(!r.ok)throw Error(data.error);clearOwnerSession();setMode('login');setMessage('Đã đổi mật khẩu và kết thúc các phiên đăng nhập trên mọi thiết bị. Hãy đăng nhập lại.');setOldPassword('');setNewPassword('');setNewConfirm('');}
  catch(e){setPasswordError((e as Error).message);}finally{working.current=false;setBusy(false);}
 }
 if(user)return <OwnerContext.Provider value={{user,logout,changePassword:()=>{setOldPassword('');setNewPassword('');setNewConfirm('');setPasswordError('');setPasswordOpen(true);}}}>{children}{passwordOpen&&<div className="owner-overlay"><div className="owner-password-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="owner-password-title"><button type="button" className="owner-close" aria-label="Đóng" disabled={busy} onClick={()=>setPasswordOpen(false)}><X size={20}/></button><h2 id="owner-password-title">Đổi mật khẩu</h2><p>Đổi thành công sẽ đăng xuất tất cả thiết bị. Nháp trên máy vẫn được giữ.</p><form onSubmit={changePassword}><label>Mật khẩu hiện tại<input type="password" autoComplete="current-password" required maxLength={128} value={oldPassword} onChange={e=>setOldPassword(e.target.value)}/></label><label>Mật khẩu mới<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><label>Nhập lại mật khẩu mới<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newConfirm} onChange={e=>setNewConfirm(e.target.value)}/></label>{passwordError&&<p className="form-error" role="alert">{passwordError}</p>}<button className="primary-btn" disabled={busy}>{busy?'Đang lưu…':'Lưu mật khẩu mới'}</button></form></div></div>}</OwnerContext.Provider>;
 return <main className="owner-login-page"><section className="owner-login-card" aria-labelledby="owner-login-title"><div className="owner-login-brand"><span><Leaf size={28}/></span><div><b>DPA</b><small>TRẢI NGHIỆM · THÁI NGUYÊN</small></div></div><div className="owner-login-icon"><LockKeyhole size={24}/></div><h1 id="owner-login-title">{loading?'Đang kết nối…':mode==='setup'?'Thiết lập Chủ quán':mode==='recover'?'Khôi phục tài khoản':'Đăng nhập Chủ quán'}</h1><p>Quản lý đặt bàn, bán hàng và sao lưu của DPA.</p>{message&&<p className="owner-message" role="status">{message}</p>}{error&&<p className="form-error" role="alert">{error}</p>}{!loading&&!available?<button className="primary-btn" onClick={()=>{setLoading(true);void check();}}><RefreshCw size={17}/>Kết nối lại</button>:!loading&&<>{!googleClientId&&<div className="owner-google owner-google-unconfigured"><button className="secondary-btn" type="button" disabled>Đăng nhập bằng Google</button><small>Chưa kết nối Google. Cần cấu hình Google Client ID và Gmail Chủ quán trên máy chủ trước khi dùng.</small></div>}{googleClientId&&mode==='login'&&<><GoogleOwnerButton clientId={googleClientId} onSuccess={googleSuccess}/><button type="button" className="owner-text-button" disabled={busy} onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Ẩn đăng nhập bằng mật khẩu':'Đăng nhập bằng mật khẩu'}</button></>}{(!googleClientId||mode!=='login'||showPassword)&&(mode!=='login'&&!setupAvailable?<div className="owner-setup-help"><b>Cần cấu hình mã thiết lập trên Cloudflare</b><p>Thêm secret <code>DPA_OWNER_SETUP_KEY</code> gồm ít nhất 32 ký tự ngẫu nhiên vào Worker, rồi tải lại trang. Chỉ chủ tài khoản Cloudflare giữ mã này.</p><button className="secondary-btn" onClick={()=>void check()}>Kiểm tra lại</button></div>:<form onSubmit={submit} aria-busy={busy}><fieldset disabled={busy}>{mode!=='login'&&<label>Mã thiết lập riêng<input type="password" autoComplete="off" required minLength={32} maxLength={512} value={setupKey} onChange={e=>setSetupKey(e.target.value)}/></label>}<label>Tên đăng nhập<input autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={64} pattern="[a-zA-Z0-9_.\-]+" value={username} onChange={e=>setUsername(e.target.value.trim())}/></label><label>Mật khẩu<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='login'?1:12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>{mode!=='login'&&<><small className="owner-password-hint">Từ 12 ký tự; nên dùng một cụm từ dài, khó đoán.</small><label>Nhập lại mật khẩu<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label></>}<button className="primary-btn" type="submit">{busy?'Đang xử lý…':mode==='login'?'Đăng nhập':mode==='setup'?'Tạo tài khoản Chủ quán':'Đặt lại tài khoản'}</button></fieldset></form>)}{configured&&(!googleClientId||showPassword||mode!=='login')&&<button className="owner-text-button" type="button" disabled={busy} onClick={()=>{setMode(mode==='login'?'recover':'login');resetFields();setError('');setMessage('');}}>{mode==='login'?'Quên mật khẩu?':'Quay lại đăng nhập'}</button>}</>}<footer><ShieldCheck size={15}/><span>Chỉ Chủ quán có quyền truy cập dữ liệu.</span></footer></section></main>;
}

import {useEffect,useRef,useState} from 'react';
import {apiRequest} from './sync';
export type OwnerLoginResult={user:{username:string;role:'owner';passwordEnabled:boolean};token:string;expiresAt:number;error?:string};
type GoogleIdentity={initialize:(options:{client_id:string;callback:(result:{credential:string})=>void;nonce:string;auto_select:boolean})=>void;renderButton:(element:HTMLElement,options:Record<string,unknown>)=>void;disableAutoSelect:()=>void};
declare global {interface Window {google?:{accounts:{id:GoogleIdentity}}}}
let scriptPromise:Promise<void>|null=null;
function loadGoogle(){
 if(window.google?.accounts?.id)return Promise.resolve();if(scriptPromise)return scriptPromise;
 scriptPromise=new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.dataset.dpaGoogle='true';
  const timer=setTimeout(()=>{script.remove();scriptPromise=null;reject(Error('Google chưa phản hồi. Hãy kiểm tra kết nối và thử lại.'));},15000);
  script.onload=()=>{clearTimeout(timer);if(window.google?.accounts?.id)resolve();else{script.remove();scriptPromise=null;reject(Error('Chưa tải được đăng nhập Google.'));}};
  script.onerror=()=>{clearTimeout(timer);script.remove();scriptPromise=null;reject(Error('Không tải được Google. Kiểm tra mạng hoặc tiện ích chặn nội dung.'));};document.head.appendChild(script);
 });return scriptPromise;
}
export function GoogleOwnerButton({clientId,onSuccess}:{clientId:string;onSuccess:(result:OwnerLoginResult)=>void}){
 const element=useRef<HTMLDivElement>(null),callback=useRef(onSuccess);callback.current=onSuccess;
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let active=true,working=false;setLoading(true);setError('');
  async function initialize(){
   try{
    await loadGoogle();if(!active)return;
    const r=await apiRequest('/api/auth/google/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),body=await r.json() as {error?:string;nonce:string;challenge:string};
    if(!r.ok)throw Error(body.error||'Chưa bắt đầu được đăng nhập Google.');if(!active||!element.current)return;
    window.google!.accounts.id.initialize({client_id:clientId,nonce:body.nonce,auto_select:false,callback:async({credential})=>{
     if(!active||working)return;working=true;setBusy(true);setError('');
     try{const response=await apiRequest('/api/auth/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential,challenge:body.challenge})}),data=await response.json() as OwnerLoginResult;
      if(!response.ok)throw Error(data.error||'Chưa đăng nhập được bằng Google.');if(active)callback.current(data);
     }catch(e){if(active)setError((e as Error).message);}finally{working=false;if(active)setBusy(false);}
    }});
    window.google!.accounts.id.renderButton(element.current,{type:'standard',theme:'outline',size:'large',text:'signin_with',shape:'rectangular',width:Math.min(366,element.current.clientWidth||300),locale:'vi'});
   }catch(e){if(active)setError((e as Error).message);}finally{if(active)setLoading(false);}
  }
  void initialize();const refresh=setInterval(()=>{if(!document.hidden&&!working)setRevision(n=>n+1);},240000);
  return()=>{active=false;clearInterval(refresh);element.current?.replaceChildren();};
 },[clientId,revision]);
 return <div className="owner-google"><div className="owner-google-button" ref={element} inert={busy} aria-busy={busy||loading}/>{loading&&<p role="status">Đang tải đăng nhập Google…</p>}{busy&&<p role="status">Đang xác thực Gmail…</p>}{error&&<div className="form-error" role="alert"><p>{error}</p><button className="secondary-btn" type="button" disabled={busy} onClick={()=>setRevision(n=>n+1)}>Thử lại Google</button></div>}<small>Chỉ Gmail được cấu hình cho Chủ quán mới đăng nhập được.</small></div>;
}

import {useState} from 'react';
import {validOrigin,resolveApiBase} from './sync-config';

declare global {interface Window {DPA_CONFIG?:{apiBase?:string}}}
const settingKey='dpa-sync-endpoint';
const isPages=location.hostname.endsWith('.github.io');
let override='';
try{const incoming=new URL(location.href).searchParams.get('api');if(incoming){override=validOrigin(incoming);localStorage.setItem(settingKey,override)}else override=localStorage.getItem(settingKey)||''}catch{ /* Settings remain available if browser storage is disabled. */ }
const configured=resolveApiBase([override,window.DPA_CONFIG?.apiBase]);
const apiBase=configured||(isPages?'':location.origin);
export function dishImageUrl(path:string){return apiBase&&/^\/api\/dish-images\/[-\da-f]{36}\?v=\d+$/i.test(path)?apiBase+path:'';}
export async function apiRequest(path:string,options:RequestInit={}){
 if(!apiBase)throw new Error('Chưa kết nối đồng bộ. Mở “Kết nối dữ liệu” và nhập đường dẫn máy chủ DPA đã triển khai.');
 let response:Response;
 try{response=await fetch(apiBase+path,{...options,credentials:'omit',signal:options.signal??AbortSignal.timeout(15000)});}catch{throw new Error('Mất kết nối máy chủ. Kiểm tra Internet rồi thử lại; thông tin đang nhập vẫn được giữ.');}
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Máy chủ chưa sẵn sàng. Kiểm tra đường dẫn trong “Kết nối dữ liệu”.');
 return response;
}
export function SyncSettings(){
 const [value,setValue]=useState(configured),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 const share=apiBase?`${location.origin}${location.pathname}?api=${encodeURIComponent(apiBase)}`:'';
 return <details className="sync-settings" open={isPages&&!apiBase||undefined}><summary>Kết nối dữ liệu {apiBase?'· Đã cấu hình':'· Cần thiết lập'}</summary><p>Chỉ thiết lập một lần. Dùng cùng máy chủ trên điện thoại và máy tính để xem chung lịch đặt bàn.</p><form onSubmit={e=>{e.preventDefault();try{localStorage.setItem(settingKey,validOrigin(value));const url=new URL(location.href);url.searchParams.set('api',validOrigin(value));location.assign(url.href)}catch(e){setError(e instanceof Error?e.message:'Không lưu được cấu hình.')}}}><label>Đường dẫn máy chủ DPA<input type="url" required value={value} onChange={e=>setValue(e.target.value)} placeholder="https://dpa-dat-ban.ten-cua-ban.workers.dev"/></label><button className="primary-btn">Lưu kết nối</button>{share&&<button type="button" className="secondary-btn" onClick={async()=>{try{await navigator.clipboard.writeText(share);setCopied(true)}catch{setError('Hãy sao chép đường dẫn trong ô bên dưới.')}}}>{copied?'Đã sao chép':'Sao chép link dùng trên thiết bị khác'}</button>}</form>{share&&<input className="share-link" aria-label="Đường dẫn cho thiết bị khác" readOnly value={share} onFocus={e=>e.target.select()}/>} {error&&<p role="alert">{error}</p>}</details>
}


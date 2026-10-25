import {supplementalCell} from './dish-supplemental';
import {useState} from 'react';
import {apiRequest} from './sync';
import type {CatalogDish} from './catalog-model';
import {DishThumbnail} from './dish-thumbnail';
import {isIllustratedDish} from './dish-image-model';
export function DishImageSettings({dish,saved,onReload}:{dish:CatalogDish;saved:boolean;onReload:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 if(!isIllustratedDish(dish.name))return null;
 async function generate(){setBusy(true);setMessage('');setError('');try{const r=await apiRequest('/api/dish-images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:dish.id})});const data=await r.json() as {message?:string;error?:string};if(!r.ok)throw Error(data.error);setMessage(data.message||'Đã xếp hàng tạo ảnh.');await onReload();}catch(e){setError(e instanceof Error?e.message:'Chưa tạo được ảnh.')}finally{setBusy(false)}}
 const status=dish.image?.status,extra=supplementalCell(dish.name);
 return <div className="catalog-image-settings"><DishThumbnail dish={dish}/><div><b>Ảnh minh họa AI</b><p>{extra!==null&&!dish.image?.url?'Đã có ảnh minh họa món này do ChatGPT tạo.':dish.image?.message||(!saved?'Lưu món để tự tạo ảnh theo tên.':status==='ready'?'Đã có ảnh riêng cho món này.':status==='generating'?'AI đang tạo ảnh riêng…':'Ảnh riêng sẽ tự tạo ở nền. Hiện dùng ảnh minh họa nhóm món.')}</p><p>Ảnh chỉ dùng khi chọn món, không in trên hóa đơn hay phiếu bếp.</p>{message&&<p role="status">{message}</p>}{error&&<p className="form-error" role="alert">{error}</p>}</div>{saved&&<button type="button" className="secondary-btn" disabled={busy||status==='generating'} onClick={()=>void generate()}>{busy?'Đang xếp hàng…':dish.image?.url||extra!==null?'Tạo lại ảnh':'Yêu cầu tạo ảnh'}</button>}</div>;
}

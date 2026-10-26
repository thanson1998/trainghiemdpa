import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {PriceInput} from './price-input';
import {groupFold} from './dish-groups';
import type {CatalogDish} from './catalog-model';

export function PosEditDish({dish,dishes,onSave,onClose}:{dish:CatalogDish;dishes:CatalogDish[];onSave:(patch:{name:string;price:number|null})=>Promise<void>;onClose:()=>void}){
 const [name,setName]=useState(dish.name),[price,setPrice]=useState(dish.price),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const box=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),inflight=useRef(false);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';input.current?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'&&!inflight.current)onClose();
   if(e.key==='Tab'){
    const fields=Array.from(box.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')??[]);
    if(e.shiftKey&&document.activeElement===fields[0]){e.preventDefault();fields.at(-1)?.focus();}
    else if(!e.shiftKey&&document.activeElement===fields.at(-1)){e.preventDefault();fields[0]?.focus();}
   }
  };
  window.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',key);previous?.focus();};
 },[onClose]);
 async function submit(){
  if(inflight.current||!name.trim()||price===null)return;
  if(dishes.some(d=>d.id!==dish.id&&groupFold(d.name)===groupFold(name))){setError('Tên món đã có trong danh sách. Hãy chọn tên khác.');return;}
  inflight.current=true;setSaving(true);setError('');
  try{await onSave({name:name.trim(),price});onClose();}
  catch(e){setError(e instanceof Error?e.message:'Chưa lưu được thay đổi. Vui lòng thử lại.');}
  finally{inflight.current=false;setSaving(false);}
 }
 return createPortal(<div className="pos-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!inflight.current)onClose();}}>
  <div className="pos-checkout pos-add-dish" ref={box} role="dialog" aria-modal="true" aria-labelledby="pos-edit-dish-title">
   <header><div><h2 id="pos-edit-dish-title">Sửa món ăn</h2><p>Cập nhật tên và giá trong danh sách món dùng chung.</p></div><button type="button" className="secondary-btn" disabled={saving} onClick={onClose}>Đóng</button></header>
   <form onSubmit={e=>{e.preventDefault();void submit();}}>
    <label>Tên món<input ref={input} required disabled={saving} maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Đơn giá (VNĐ)<PriceInput label="Đơn giá món đang sửa" required disabled={saving} value={price} onChange={setPrice}/></label>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <p className="field-help">Tên và giá mới áp dụng khi chọn món từ danh sách. Món đã có trên phiếu giữ nguyên tên và giá đang dùng.</p>
    <button className="primary-btn" disabled={saving||!name.trim()||price===null}>{saving?'Đang lưu…':'Lưu thay đổi'}</button>
   </form>
  </div>
 </div>,document.body);
}

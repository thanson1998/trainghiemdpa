import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {MenuEditor} from './menu-editor';
import {cleanSetName} from './set-names';
import {prepareTemplateMenu,readMenu,readMenuSet,writeMenu,validMenu} from './menu';
import type {Catalog,CatalogTemplate} from './catalog-model';

export function PosEditTemplate({template,catalog,onSave,onClose}:{template:CatalogTemplate;catalog:Catalog;onSave:(value:CatalogTemplate)=>Promise<void>;onClose:()=>void}){
 const [name,setName]=useState(template.name),[menu,setMenu]=useState(()=>prepareTemplateMenu(template.menu,template.name)),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const box=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),inflight=useRef(false);
 useEffect(()=>{const previous=document.activeElement as HTMLElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';input.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!inflight.current)onClose();if(e.key==='Tab'){const fields=Array.from(box.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')??[]);if(e.shiftKey&&document.activeElement===fields[0]){e.preventDefault();fields.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===fields.at(-1)){e.preventDefault();fields[0]?.focus();}}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=overflow;previous?.focus();};},[onClose]);
 async function submit(){
  if(inflight.current)return;
  const items=readMenu(menu).filter(i=>i.name.trim()),set=readMenuSet(menu);
  const title=set?cleanSetName(name.trim(),set):name.trim();
  const next=writeMenu(items.map(i=>set&&i.price===null?{...i,included:true}:i),set?{...set,name:title,quantity:1}:undefined);
  if(!title||title.length>100||!items.length||!validMenu(next)){setError('Kiểm tra tên set, giá, số người và danh sách món trước khi lưu.');return;}
  if(catalog.templates.some(t=>t.id!==template.id&&t.name.normalize('NFC').trim().toLocaleLowerCase('vi')===title.toLocaleLowerCase('vi'))){setError('Tên set đã có. Hãy dùng số thứ tự hoặc tên khác để phân biệt.');return;}
  inflight.current=true;setSaving(true);setError('');try{await onSave({...template,name:title,menu:next});onClose();}catch(e){setError(e instanceof Error?e.message:'Chưa lưu được thực đơn mẫu.');}finally{inflight.current=false;setSaving(false);}
 }
 return createPortal(<div className="pos-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!inflight.current)onClose();}}><div ref={box} className="pos-checkout pos-template-editor" role="dialog" aria-modal="true" aria-labelledby="pos-edit-template-title"><header><div><h2 id="pos-edit-template-title">Sửa thực đơn mẫu</h2><p>Cập nhật thông tin set dùng chung.</p></div><button type="button" className="secondary-btn" disabled={saving} onClick={onClose}>Đóng</button></header><form onSubmit={e=>{e.preventDefault();void submit();}}><fieldset disabled={saving}><label>Tên set<input ref={input} aria-label="Tên set mẫu" required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><MenuEditor value={menu} onChange={setMenu} catalog={catalog} allowTemplates={false} editingTemplate/></fieldset>{error&&<p className="form-error" role="alert">{error}</p>}<p className="field-help">Thay đổi áp dụng cho lần chọn set sau. Phiếu đã lưu giữ nguyên món và giá.</p><button className="primary-btn" disabled={saving}>{saving?'Đang lưu…':'Lưu thực đơn mẫu'}</button></form></div></div>,document.body);
}

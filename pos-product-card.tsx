import {Star,Plus,Settings2,Pencil} from 'lucide-react';
import {useState} from 'react';
import {DishThumbnail} from './dish-thumbnail';
import {dishGroup} from './dish-groups';
import {money} from './model';
import type {CatalogDish} from './catalog-model';
export function PosProductCard({dish:d,quantity,disabled,onAdd,onFlag,onEdit,manageTools=false}:{dish:CatalogDish;quantity:number;disabled:boolean;onAdd:()=>void;onEdit:()=>void;onFlag:(key:'pinned'|'soldOut',value:boolean)=>void;manageTools?:boolean}){
 const [manage,setManage]=useState(false);
 return <article className={'pos-product-tile'+(d.soldOut?' sold-out':'')+(quantity?' is-selected':'')+(manageTools?' tools-visible':'')}>
 <button type="button" className="pos-product pos-product-main" disabled={disabled||d.soldOut} onClick={onAdd} aria-label={'Thêm '+d.name+(quantity?' · đã chọn '+quantity:'')}><DishThumbnail dish={d}/><b>{d.name}</b><small>{d.unit} · {dishGroup(d)}</small><div className="pos-product-price"><strong>{d.price===null?'Nhập giá':money(d.price)}</strong><span className="pos-product-plus"><Plus size={17}/></span></div><span className={'pos-selected-quantity'+(d.soldOut?' unavailable':'')}>{d.soldOut?'Tạm hết món':quantity?'Đã chọn: '+quantity:manageTools?'Chạm để thêm':''}</span></button>
 {manageTools&&<div className="pos-product-tools"><button type="button" disabled={disabled} aria-label={'Sửa món '+d.name} onClick={onEdit}><Pencil size={15}/><span>Sửa</span></button><button type="button" disabled={disabled} title={d.pinned?'Bỏ ghim món khỏi nhóm Hay dùng':'Ghim món vào nhóm Hay dùng'} aria-label={(d.pinned?'Bỏ ghim ':'Ghim ')+d.name} aria-pressed={!!d.pinned} className={d.pinned?'pinned':''} onClick={()=>onFlag('pinned',!d.pinned)}><Star size={15} fill={d.pinned?'currentColor':'none'}/><span>{d.pinned?'Đã ghim':'Ghim'}</span></button><button type="button" disabled={disabled} aria-expanded={manage} aria-label={'Tình trạng '+d.name} className={d.soldOut?'stock-empty':''} onClick={()=>setManage(v=>!v)}><Settings2 size={15}/><span>Còn / hết</span></button></div>}
 {manageTools&&manage&&<div className="pos-stock-action"><button type="button" className={'secondary-btn '+(d.soldOut?'action-available':'action-warning')} disabled={disabled} onClick={()=>{onFlag('soldOut',!d.soldOut);setManage(false);}}>{d.soldOut?'Đã có món trở lại':'Đánh dấu tạm hết'}</button></div>}
 </article>;
}

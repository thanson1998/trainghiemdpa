import {Star,Plus,Settings2} from 'lucide-react';
import {useState} from 'react';
import {DishThumbnail} from './dish-thumbnail';
import {dishGroup} from './dish-groups';
import {money} from './model';
import type {CatalogDish} from './catalog-model';
export function PosProductCard({dish:d,quantity,disabled,onAdd,onFlag}:{dish:CatalogDish;quantity:number;disabled:boolean;onAdd:()=>void;onFlag:(key:'pinned'|'soldOut',value:boolean)=>void}){
 const [manage,setManage]=useState(false);
 return <article className={'pos-product-tile'+(d.soldOut?' sold-out':'')+(quantity?' is-selected':'')}>
 <button type="button" className="pos-product pos-product-main" disabled={disabled||d.soldOut} onClick={onAdd} aria-label={'Thêm '+d.name+(quantity?' · đã chọn '+quantity:'')}><DishThumbnail dish={d}/><b>{d.name}</b><small>{d.unit} · {dishGroup(d)}</small><div className="pos-product-price"><strong>{d.price===null?'Nhập giá':money(d.price)}</strong><span className="pos-product-plus"><Plus size={17}/></span></div><span className={'pos-selected-quantity'+(d.soldOut?' unavailable':'')}>{d.soldOut?'Tạm hết món':quantity?'Đã chọn: '+quantity:'Chạm để thêm'}</span></button>
 <div className="pos-product-tools"><button type="button" disabled={disabled} aria-label={(d.pinned?'Bỏ ghim ':'Ghim ')+d.name} aria-pressed={!!d.pinned} className={d.pinned?'pinned':''} onClick={()=>onFlag('pinned',!d.pinned)}><Star size={15} fill={d.pinned?'currentColor':'none'}/></button><button type="button" disabled={disabled} aria-expanded={manage} aria-label={'Tình trạng '+d.name} onClick={()=>setManage(v=>!v)}><Settings2 size={15}/></button></div>
 {manage&&<div className="pos-stock-action"><button type="button" className="secondary-btn" disabled={disabled} onClick={()=>{onFlag('soldOut',!d.soldOut);setManage(false);}}>{d.soldOut?'Đã có món trở lại':'Đánh dấu tạm hết'}</button></div>}
 </article>;
}

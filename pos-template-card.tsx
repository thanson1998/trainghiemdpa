import './pos-template-card.css';
import {Star,Plus,Settings2,Pencil} from 'lucide-react';
import {useState} from 'react';
import {TemplateThumbnail} from './template-thumbnail';
import {templateFlags} from './template-flags';
import {readMenu,readMenuSet,hasPricedMenu,menuSum,prepareTemplateMenu} from './menu';
import {money} from './model';
import type {CatalogDish,CatalogTemplate} from './catalog-model';
export function PosTemplateCard({template:t,dishes,quantity,disabled,onApply,onEdit,onFlag}:{template:CatalogTemplate;dishes:CatalogDish[];quantity:number;disabled:boolean;onApply:()=>void;onEdit:()=>void;onFlag:(key:'pinned'|'soldOut',value:boolean)=>void}){
 const [manage,setManage]=useState(false),flags=templateFlags(t.menu),set=readMenuSet(prepareTemplateMenu(t.menu,t.name));
 return <article className={'pos-product-tile pos-template-card tools-visible'+(flags.soldOut?' sold-out':'')}>
 <button type="button" className="pos-product pos-product-main pos-template" aria-label={'Áp dụng '+t.name} disabled={disabled||flags.soldOut||!Number.isInteger(quantity)||quantity<1||quantity>1000} onClick={onApply}><TemplateThumbnail template={t} dishes={dishes}/><b>{t.name}</b><small>{readMenu(t.menu).length} món{set?.people?' · '+set.people+' người / set':''}</small><div className="pos-product-price"><strong>{set?(set.pricePerTable?money(set.pricePerTable):'Trong set · chưa đặt giá'):hasPricedMenu(t.menu)?money(menuSum(t.menu)):'Nhập giá khi chọn'}</strong><span className="pos-product-plus"><Plus size={17}/></span></div><span className={'pos-selected-quantity'+(flags.soldOut?' unavailable':'')}>{flags.soldOut?'Tạm hết set':set?'Áp dụng '+quantity+' set':'Thêm vào phiếu'}</span></button>
 <div className="pos-product-tools"><button type="button" disabled={disabled} aria-label={'Sửa set '+t.name} onClick={onEdit}><Pencil size={15}/><span>Sửa</span></button><button type="button" disabled={disabled} aria-label={(flags.pinned?'Bỏ ghim set ':'Ghim set ')+t.name} aria-pressed={flags.pinned} className={flags.pinned?'pinned':''} onClick={()=>onFlag('pinned',!flags.pinned)}><Star size={15} fill={flags.pinned?'currentColor':'none'}/><span>{flags.pinned?'Đã ghim':'Ghim'}</span></button><button type="button" disabled={disabled} aria-expanded={manage} aria-label={'Tình trạng set '+t.name} className={flags.soldOut?'stock-empty':''} onClick={()=>setManage(v=>!v)}><Settings2 size={15}/><span>Còn / hết</span></button></div>
 {manage&&<div className="pos-stock-action"><button type="button" className={'secondary-btn '+(flags.soldOut?'action-available':'action-warning')} disabled={disabled} onClick={()=>{onFlag('soldOut',!flags.soldOut);setManage(false);}}>{flags.soldOut?'Đã có set trở lại':'Đánh dấu tạm hết'}</button></div>}
 </article>;
}

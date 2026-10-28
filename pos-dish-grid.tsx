import {memo,useEffect,useMemo,useRef,useState} from 'react';
import {PosProductCard} from './pos-product-card';
import {selectedQuantity} from './pos-insights';
import {readMenu} from './menu';
import type {CatalogDish} from './catalog-model';
const batchSize=48;
export const PosDishGrid=memo(function PosDishGrid({dishes,menu,units,disabled,onAdd,onEdit,onFlag}:{dishes:CatalogDish[];menu:string;units:number;disabled:boolean;onAdd:(dish:CatalogDish)=>void;onEdit:(dish:CatalogDish)=>void;onFlag:(id:string,key:'pinned'|'soldOut',value:boolean)=>void}){
 const [limit,setLimit]=useState(batchSize),more=useRef<HTMLButtonElement>(null);
 const items=useMemo(()=>readMenu(menu,units),[menu,units]);
 useEffect(()=>{const node=more.current;if(!node||typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))setLimit(n=>Math.min(n+batchSize,dishes.length));},{root:node.closest('.pos-catalog-body'),rootMargin:'200px'});observer.observe(node);return()=>observer.disconnect();},[limit,dishes.length]);
 return <><div className="pos-product-grid">{dishes.slice(0,limit).map(d=><PosProductCard key={d.id} dish={d} manageTools quantity={selectedQuantity(items,d.name)} disabled={disabled} onAdd={()=>onAdd(d)} onEdit={()=>onEdit(d)} onFlag={(key,value)=>onFlag(d.id,key,value)}/>)}</div>{limit<dishes.length&&<button ref={more} type="button" className="secondary-btn pos-more-dishes" onClick={()=>setLimit(n=>Math.min(n+batchSize,dishes.length))}>Xem thêm món ({dishes.length-limit})</button>}</>;
});

import type {Catalog} from './catalog-model';
import {normalizeUnit,writeMenu,validMenu,readMenu,readMenuSet,type MenuItem} from './menu';
export type CatalogAiDraft={kind:'template'|'dishes';name:string;price:number|null;items:MenuItem[];warnings:string[]};
const key=(name:string)=>name.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
export function catalogAiMenu(draft:CatalogAiDraft){
 const items=draft.items.map(i=>({...i,name:i.name.trim(),unit:normalizeUnit(i.unit),...(draft.price!==null?{price:null,included:true}:{included:undefined})}));
 return writeMenu(items,draft.price!==null?{name:draft.name.trim(),pricePerTable:draft.price,quantity:1}:undefined);
}
export function mergeAiCatalog(current:Catalog,draft:CatalogAiDraft){
 if(!draft.items.length||draft.items.length>80||draft.items.some(i=>!i.name.trim()||i.name.length>200||normalizeUnit(i.unit).length>30)||!validMenu(writeMenu(draft.items)))throw Error('Kiểm tra tên, đơn vị, số lượng và giá của các món.');
 if(draft.kind==='template'){
  if(!draft.name.trim()||draft.name.length>100)throw Error('Tên thực đơn cần từ 1 đến 100 ký tự.');
  const menu=catalogAiMenu(draft);if(!validMenu(menu))throw Error('Kiểm tra giá và thành phần thực đơn.');
  const existing=current.templates.find(t=>key(t.name)===key(draft.name));
  const signature=(value:string)=>JSON.stringify({set:readMenuSet(value),items:readMenu(value,1,false)});
  if(existing){if(signature(existing.menu)===signature(menu))return {catalog:current,added:0,skipped:1};throw Error('Tên thực đơn này đã có trong thư viện. Hãy đổi tên để thêm bản mới.');}
  if(current.templates.length>=100)throw Error('Thư viện đã đủ 100 thực đơn mẫu.');
  return {catalog:{...current,templates:[...current.templates,{id:crypto.randomUUID(),name:draft.name.trim(),menu}]},added:1,skipped:0};
 }
 const seen=new Set(current.dishes.map(d=>key(d.name)));let skipped=0;
 const added=draft.items.flatMap(i=>{if(seen.has(key(i.name))){skipped++;return [];}seen.add(key(i.name));return [{id:crypto.randomUUID(),name:i.name.trim(),unit:normalizeUnit(i.unit),price:i.price}];});
 if(current.dishes.length+added.length>500)throw Error('Thư viện tối đa 500 món mẫu.');
 return {catalog:{...current,dishes:[...added,...current.dishes]},added:added.length,skipped};
}

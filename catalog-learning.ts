import {inferDishGroup} from './dish-groups';
import {readMenu} from './menu';
import type {Catalog} from './catalog-model';
const key=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();
export function mergeLearnedDishes(catalog:Catalog,menu:string,names:string[]){
 const selected=new Set(names.map(key));const dishes=catalog.dishes.map(d=>({...d}));let changed=false;const warnings:string[]=[];
 for(const item of readMenu(menu)){
  if(item.included||!item.name.trim()||!selected.has(key(item.name)))continue;
  const matches=dishes.filter(d=>key(d.name)===key(item.name));
  if(matches.length>1){warnings.push('Có nhiều món cùng tên '+item.name+' trong thư viện; cần sửa giá thủ công.');continue;}
  if(matches.length===1){const old=matches[0];if(item.price!==null&&old.price!==item.price){old.price=item.price;changed=true;}}
  else if(dishes.length<500){dishes.push({id:crypto.randomUUID(),name:item.name.trim(),price:item.price,unit:item.unit?.trim()||'đĩa',category:inferDishGroup(item.name)});changed=true;}
  else warnings.push('Thư viện đã đủ 500 món, chưa thêm được '+item.name+'.');
 }
 return {catalog:{...catalog,dishes},changed,warning:warnings.join(' ')};
}
export async function learnCatalogFromMenu(db:D1Database,menu:string,names:string[]):Promise<string>{
 if(!names.length)return '';
 try{
  for(let attempt=0;attempt<3;attempt++){
   const {results}=await db.prepare('SELECT data,version FROM menu_catalog WHERE id=?').bind('dpa-shared').all<{data:string;version:number}>();
   const row=results[0],catalog:Catalog=row?{...JSON.parse(row.data),version:row.version}:{dishes:[],templates:[],version:0};
   const merged=mergeLearnedDishes(catalog,menu,names);if(!merged.changed)return merged.warning;
   const {version,...data}=merged.catalog;const now=new Date().toISOString();
   const write=row?await db.prepare('UPDATE menu_catalog SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(data),now,'dpa-shared',version).run():await db.prepare('INSERT INTO menu_catalog (id,data,version,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind('dpa-shared',JSON.stringify(data),now).run();
   if(write.meta.changes)return merged.warning;
  }
  return 'Thư viện đang thay đổi trên thiết bị khác; đơn đã lưu nhưng chưa cập nhật được giá vào thư viện.';
 }catch{return 'Đơn đã lưu nhưng chưa cập nhật được món và giá vào thư viện. Hãy kiểm tra mục Thư viện thực đơn.';}
}

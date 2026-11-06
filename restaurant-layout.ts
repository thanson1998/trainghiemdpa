import type {Zone} from './model';
export const restaurantPlan='restaurant-20261106';
// Preserve all storage IDs referenced by orders. Retired positions remain available
// only when inspecting an old assignment; no reservation is reassigned implicitly.
export function redesignRestaurant(zones:Zone[]):Zone[]{
 if(zones.some(z=>z.id==='YARD'))return zones;
 const yard:Zone={id:'YARD',title:'Sân trung tâm',sub:'20 bàn · 4 hàng × 5 bàn',type:'patio',count:20,tables:Array.from({length:20},(_,i)=>'YARD-'+String(i+1).padStart(2,'0')),tableNames:Object.fromEntries(Array.from({length:20},(_,i)=>['YARD-'+String(i+1).padStart(2,'0'),String(i+1)]))};
 const homes=['N3','N2','N1'].map((id,index)=>{
  const old=zones.find(z=>z.id===id),tables=Array.from({length:6},(_,i)=>old?.tables[i]??id+'-'+String(i+1).padStart(2,'0'));
  return {...old,id,title:'Nhà '+(3-index),sub:'Không gian trong nhà',type:'inside',count:6,tables,tableNames:Object.fromEntries(tables.map((t,i)=>[t,old?.tableNames?.[t]??String(i+1).padStart(2,'0')]))} as Zone;
 });
 const high=zones.find(z=>z.id==='NTC');
 const retired=zones.filter(z=>!['N3','N2','N1','NTC'].includes(z.id)).map(z=>({...z,retired:true}));
 for(const home of homes){const old=zones.find(z=>z.id===home.id),extra=old?.tables.filter(t=>!home.tables.includes(t))??[];if(extra.length)retired.push({...old!,id:home.id+'-OLD',title:old!.title+' (cũ)',count:extra.length,tables:extra,retired:true});}
 return [yard,...homes,...(high?[high]:[]),...retired];
}

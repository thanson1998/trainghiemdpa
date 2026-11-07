import {readMenu,readMenuSet,menuSetQuantity,itemAmount,itemQuantity,itemUnit} from './menu';
import {orderUnits} from './model';
import {paymentDay,type SalesDateFilter} from './sales-date';
import type {Payment} from './payments-panel';
export type ProductRow={key:string;name:string;unit:string;kind:'dish'|'set';quantity:number;includedQuantity:number;revenue:number;orders:number};
export function paymentProductsReport(payments:Payment[],filter:SalesDateFilter){
 const unique=new Map<string,Payment>();
 for(const p of payments){if(p.booking.status==='cancelled')continue;const day=filter.dateBy==='paidAt'?paymentDay(p.paidAt):p.booking.date;if(day<filter.from||day>filter.to)continue;const old=unique.get(p.booking.id);if(!old||old.paidAt<p.paidAt)unique.set(p.booking.id,p);}
 const products=new Map<string,ProductRow>(),days=new Map<string,{date:string;orders:number;revenue:number}>();
 const methods={cash:{orders:0,revenue:0,deposit:0,received:0},transfer:{orders:0,revenue:0,deposit:0,received:0}};
 let revenue=0,deposit=0,received=0,unpricedLines=0;
 const add=(name:string,unit:string,kind:'dish'|'set',quantity:number,included:number,amount:number,seen:Set<string>)=>{
  const display=name.normalize('NFC').trim().replace(/\s+/g,' ');const key=kind+'|'+display.toLocaleLowerCase('vi')+'|'+unit;
  const row=products.get(key)??{key,name:display,unit,kind,quantity:0,includedQuantity:0,revenue:0,orders:0};
  row.quantity+=quantity;row.includedQuantity+=included;row.revenue+=amount;if(!seen.has(key)){row.orders++;seen.add(key);}products.set(key,row);
 };
 for(const p of unique.values()){
  revenue+=p.total;deposit+=p.deposit;received+=p.received;
  const method=methods[p.method];method.orders++;method.revenue+=p.total;method.deposit+=p.deposit;method.received+=p.received;
  const date=filter.dateBy==='paidAt'?paymentDay(p.paidAt):p.booking.date,d=days.get(date)??{date,orders:0,revenue:0};d.orders++;d.revenue+=p.total;days.set(date,d);
  const seen=new Set<string>(),b=p.booking,set=readMenuSet(b.menu);
  if(set?.parts)for(const part of set.parts)add(part.name,'set','set',part.quantity,0,part.quantity*part.pricePerTable,seen);
  else if(set){const qty=menuSetQuantity(b.menu,orderUnits(b));add(set.name,'set','set',qty,0,qty*set.pricePerTable,seen);}
  for(const item of readMenu(b.menu,orderUnits(b))){if(!item.name.trim())continue;const qty=itemQuantity(item);if(!item.included&&item.price===null)unpricedLines++;add(item.name,itemUnit(item),'dish',qty,item.included?qty:0,item.included?0:itemAmount(item),seen);}
 }
 const rows=[...products.values()].map(r=>({...r,quantity:Math.round(r.quantity*100)/100,includedQuantity:Math.round(r.includedQuantity*100)/100}));
 const revenueByProducts=rows.reduce((s,r)=>s+r.revenue,0),byRevenue=(a:ProductRow,b:ProductRow)=>b.revenue-a.revenue||a.name.localeCompare(b.name,'vi');
 return {rows:rows.sort(byRevenue),orders:unique.size,revenue,deposit,received,average:unique.size?Math.round(revenue/unique.size):0,revenueByProducts,adjustment:revenue-revenueByProducts,unpricedLines,methods,days:[...days.values()].sort((a,b)=>b.date.localeCompare(a.date)),bestSellers:rows.filter(r=>r.kind==='dish').sort((a,b)=>b.quantity-a.quantity||b.revenue-a.revenue||a.name.localeCompare(b.name,'vi')).slice(0,10),topRevenue:rows.filter(r=>r.kind==='dish'&&r.revenue>0).sort(byRevenue).slice(0,10),sets:rows.filter(r=>r.kind==='set').sort(byRevenue)};
}

import {isTakeaway,orderUnits,bookingTotal,type Booking} from './model';
import {pricePerSelectedTable,readMenuSet,setMenuQuantity,menuSetQuantity} from './menu';
export function updateBookingDraft(draft:Booking,key:keyof Booking,value:unknown):Booking{
 const next={...draft,[key]:value} as Booking;
 if(key==='serviceType'&&isTakeaway(next)&&!isTakeaway(draft)){
  if(readMenuSet(draft.menu)&&orderUnits(draft)>0)next.menu=setMenuQuantity(draft.menu,menuSetQuantity(draft.menu,orderUnits(draft)),orderUnits(draft));
  next.tables=[];
  if(next.priceMode!=='auto')next.price=bookingTotal(draft);
 }
 if(isTakeaway(next))next.tables=[];
 if(key==='price')next.priceMode='agreed';
 if((key==='menu'||key==='tables'||key==='priceMode'||key==='serviceType')&&next.priceMode==='auto')next.price=pricePerSelectedTable(next.menu,orderUnits(next));
 if(next.totalPeople!=null&&(key==='totalPeople'||key==='tables'))next.people=Math.min(1000,Math.max(1,Math.ceil(next.totalPeople/(next.tables.length||1))));
 return next;
}


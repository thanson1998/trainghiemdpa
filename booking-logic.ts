import type {Booking} from './model';
import {pricePerSelectedTable} from './menu';
export function updateBookingDraft(draft:Booking,key:keyof Booking,value:unknown):Booking{
 const next={...draft,[key]:value} as Booking;
 if(key==='price')next.priceMode='agreed';
 if((key==='menu'||key==='tables'||key==='priceMode')&&next.priceMode==='auto')next.price=pricePerSelectedTable(next.menu,next.tables.length);
 if(next.totalPeople!=null&&(key==='totalPeople'||key==='tables'))next.people=Math.min(1000,Math.max(1,Math.ceil(next.totalPeople/(next.tables.length||1))));
 return next;
}

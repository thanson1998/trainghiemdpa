import {orderUnits,isTakeaway,orderLocation,guestCount,type Booking} from './model';
import {readMenu,itemQuantity,itemUnit,type MenuItem} from './menu';
type Change={name:string;unit:string;quantity:number};
const key=(item:MenuItem)=>[item.name.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi'),itemUnit(item).toLocaleLowerCase('vi'),!!item.included].join('|');
function grouped(b:Booking){const result=new Map<string,MenuItem>();for(const item of readMenu(b.menu,orderUnits(b)).filter(i=>i.name.trim())){const k=key(item),prev=result.get(k);result.set(k,{...item,quantity:(prev?itemQuantity(prev):0)+itemQuantity(item)});}return result;}
export function kitchenDelta(previous:Booking,current:Booking){
 const before=grouped(previous),after=grouped(current),added:Change[]=[],removed:Change[]=[],notes:string[]=[];
 for(const k of new Set([...before.keys(),...after.keys()])){const old=before.get(k),next=after.get(k),delta=Math.round(((next?itemQuantity(next):0)-(old?itemQuantity(old):0))*100)/100;
  const item=next??old!;if(delta>0)added.push({name:item.name,unit:itemUnit(item),quantity:delta});if(delta<0)removed.push({name:item.name,unit:itemUnit(item),quantity:-delta});
  if(old&&next&&old.price!==next.price)notes.push('Đổi đơn giá '+next.name+'; số lượng cần làm thêm chỉ tính ở mục THÊM.');
 }
 if(isTakeaway(previous)!==isTakeaway(current))notes.push('Đổi hình thức: '+orderLocation(previous)+' → '+orderLocation(current));
 else if([...previous.tables].sort().join('|')!==[...current.tables].sort().join('|'))notes.push('Chuyển bàn: '+previous.tables.join(', ')+' → '+current.tables.join(', '));
 if(previous.date!==current.date||previous.start!==current.start||previous.end!==current.end)notes.push('Thời gian cũ: '+previous.date.split('-').reverse().join('/')+' '+previous.start+'–'+previous.end+'. Thời gian mới ghi trên phiếu.');
 if(previous.note!==current.note)notes.push('Ghi chú phục vụ đã thay đổi. Hãy đọc ghi chú mới trên phiếu.');
 if(guestCount(previous)!==guestCount(current))notes.push('Số khách đã thay đổi; xem tổng số khách mới trên phiếu.');
 return {added,removed,notes,changed:!!(added.length||removed.length||notes.length)};
}


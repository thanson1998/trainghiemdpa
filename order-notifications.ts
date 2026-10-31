import {vietnamClock} from './vietnam-time';
import {guestCount,orderLocation,orderUnits,money,type Booking} from './model';
import {readMenuSet,menuText,readMenu,menuSetQuantity,itemQuantity,itemUnit,itemAmount} from './menu';
export const reportTimes=['06:00','10:00','14:00','18:00','22:00'];
export function telegramReportSlot(now:number){
 const time=vietnamClock(now).time;
 if(time<reportTimes[0]||time>reportTimes[reportTimes.length-1])return undefined;
 return reportTimes.filter(slot=>slot<=time).at(-1);
}
const statusLabel={reserved:'Đã đặt',arrived:'Đang phục vụ',completed:'Hoàn tất, chưa thanh toán',cancelled:'Đã hủy'};
function telegramBookingDetails(b:Booking){
 return [b.orderCode||b.id,`${b.start}–${b.end} | ${orderLocation(b)}`,'Trạng thái: '+statusLabel[b.status],`Khách: ${b.name} | ${guestCount(b)} người`,...(b.phone?['Điện thoại: '+b.phone]:[]),...(readMenuSet(b.menu)?.name?['Set đặt: '+readMenuSet(b.menu)!.name]:[]),'Thực đơn:\n'+(menuText(b.menu)||'Chưa cập nhật'),...(b.note?['Ghi chú: '+b.note]:[])].join('\n');
}
export function telegramSummary(bookings:Booking[],now:number){
 const clock=vietnamClock(now);
 // Match POS open orders, including serving and completed-but-unpaid orders.
 const open=bookings.filter(b=>b.date===clock.date&&b.status!=='cancelled'&&!b.paidAt).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
 const count=(status:Booking['status'])=>open.filter(b=>b.status===status).length;
 const tables=new Set(open.filter(b=>b.serviceType!=='takeaway').flatMap(b=>b.tables)).size;
 const text=[`DPA · ${clock.date.split('-').reverse().join('/')} · Cập nhật ${clock.time} (giờ Việt Nam)`,`Đơn đang mở: ${open.length} | Bàn: ${tables}`,`Đã đặt: ${count('reserved')} | Đang phục vụ: ${count('arrived')} | Hoàn tất chưa thanh toán: ${count('completed')}`,`Mang về: ${open.filter(b=>b.serviceType==='takeaway').length}`,'',open.length?open.map(telegramBookingDetails).join('\n\n--------------------\n\n'):'Hiện không có đơn đang mở chưa thanh toán trong ngày.','','Dữ liệu tại thời điểm gửi. Kiểm tra website để xem cập nhật mới nhất:','https://thanson1998.github.io/trainghiemdpa/'].join('\n');
 return {text,openCount:open.length,tableCount:tables};
}
export function telegramJobs(bookings:Booking[],now:number){
 const clock=vietnamClock(now),slot=telegramReportSlot(now);
 const summary=telegramSummary(bookings,now);
 const jobs=slot?[{key:'interval/v3/'+clock.date+'/'+slot.replace(':',''),text:'BÁO CÁO ĐƠN ĐANG MỞ — '+slot+'\n'+summary.text}]:[];
 for(const b of bookings){
  const start=Date.parse(b.date+'T'+b.start+':00+07:00');
  if(b.status!=='reserved'||b.paidAt||b.serviceType==='takeaway'||!Number.isFinite(start)||now<start-7200000||now>=start)continue;
  const id=Array.from(new TextEncoder().encode(b.id),byte=>byte.toString(16).padStart(2,'0')).join('');
  jobs.push({key:'arrival/'+b.date+'/'+id+'/'+b.start.replace(':',''),text:'NHẮC LỊCH ĐẶT BÀN — TRƯỚC GIỜ ĐẾN 2 TIẾNG\nNgày '+b.date.split('-').reverse().join('/')+' (giờ Việt Nam)\n'+telegramBookingDetails(b)});
 }
 return jobs;
}
export type TelegramPayment={booking:Booking;total:number;deposit:number;received:number;tendered:number;method:'cash'|'transfer';paidAt:string};
export function telegramPaymentText(p:TelegramPayment){
 const b=p.booking,clock=vietnamClock(Date.parse(p.paidAt)),set=readMenuSet(b.menu),units=orderUnits(b);
 const items=readMenu(b.menu,units).filter(i=>i.name.trim()).map((item,i)=>`${i+1}. ${item.name} · ${itemQuantity(item)} ${itemUnit(item)}\n   ${item.included?'Trong set':item.price===null?'Theo giá đã chốt':money(item.price)+' × '+itemQuantity(item)+' = '+money(itemAmount(item))}`);
 return ['THANH TOÁN THÀNH CÔNG',`Lúc: ${clock.time} · ${clock.date.split('-').reverse().join('/')} (giờ Việt Nam)`,`Mã đơn: ${b.orderCode||b.id}`,orderLocation(b),`Khách: ${b.name} | ${guestCount(b)} người`,...(b.phone?['Điện thoại: '+b.phone]:[]),`Ngày phục vụ: ${b.date.split('-').reverse().join('/')} · ${b.start}–${b.end}`,'','CHI TIẾT ĐƠN',...(set?[`${set.name} · ${menuSetQuantity(b.menu,units)} set × ${money(set.pricePerTable)} = ${money(set.pricePerTable*menuSetQuantity(b.menu,units))}`]:[]),...(items.length?items:['Chưa có danh sách món. Thanh toán theo giá đã lưu.']),...(b.note?['Ghi chú: '+b.note]:[]),'',`Tổng hóa đơn: ${money(p.total)}`,`Đã đặt cọc: ${money(p.deposit)}`,`THỰC THU LẦN NÀY: ${money(p.received)}`,'Phương thức: '+(p.method==='cash'?'Tiền mặt':'Chuyển khoản'),...(p.method==='cash'?[`Tiền khách đưa: ${money(p.tendered)}`,`Trả lại khách: ${money(p.tendered-p.received)}`]:[]),'Còn phải thu: '+money(0),'','Đây là giao dịch thanh toán đã được ghi nhận trên POS.'].join('\n');
}

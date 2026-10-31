import {paymentBooking} from './payments-api';
import {bookingTotal,guestCount,isTakeaway,money,orderLocation,type Booking} from './model';
import {vietnamClock} from './vietnam-time';
export type RevenueOrder={booking:Booking;paymentTotal?:number};
export function monthlyRevenueSummary(orders:RevenueOrder[],now:number){
 const clock=vietnamClock(now),from=clock.date.slice(0,7)+'-01',to=clock.date;
 // A booking is counted once, from its current state; audit snapshots are never added.
 const rows=[...new Map(orders.filter(r=>r.booking.date>=from&&r.booking.date<=to).map(r=>[r.booking.id,r])).values()];
 const cancelled=rows.filter(r=>r.booking.status==='cancelled'),active=rows.filter(r=>r.booking.status!=='cancelled');
 const paid=active.filter(r=>r.paymentTotal!==undefined),unpaid=active.filter(r=>r.paymentTotal===undefined);
 const revenue=paid.reduce((n,r)=>n+r.paymentTotal!,0),unpaidValue=unpaid.reduce((n,r)=>n+bookingTotal(r.booking),0);
 const guests=active.filter(({booking:b,paymentTotal})=>!isTakeaway(b)&&(paymentTotal!==undefined||b.status==='arrived'||b.status==='completed')).reduce((n,r)=>n+guestCount(r.booking),0);
 const sorted=[...paid].sort((a,b)=>a.paymentTotal!-b.paymentTotal!||a.booking.id.localeCompare(b.booking.id));
 const lowest=sorted[0],highest=sorted.at(-1);
 const describe=(r:RevenueOrder|undefined)=>r?money(r.paymentTotal!)+' · '+(r.booking.orderCode||r.booking.id)+'\n'+orderLocation(r.booking)+' · '+r.booking.name:'Chưa có đơn đã thanh toán.';
 const fmt=(date:string)=>date.split('-').reverse().join('/');
 const text=['BÁO CÁO DOANH THU THÁNG '+clock.date.slice(5,7)+'/'+clock.date.slice(0,4),'Từ '+fmt(from)+' đến '+fmt(to)+' · Cập nhật '+clock.time+' (giờ Việt Nam)','Tính theo ngày phục vụ trên POS.','',
 'Tổng số đơn: '+rows.length,'Đơn hủy: '+cancelled.length,'Đơn không hủy: '+active.length+' (đã thanh toán: '+paid.length+' · chưa thu: '+unpaid.length+')',
 'Khách ghé quán: '+guests+' người','Khách tính theo phiếu tại quán đã phục vụ/hoàn tất hoặc thanh toán; không gồm mang về, hủy và chỉ đặt trước.','',
 'DOANH THU ĐÃ THANH TOÁN: '+money(revenue),'Không tính đơn hủy; tổng hóa đơn đã gồm tiền cọc, không cộng cọc lần nữa.',
 'Giá trị đơn chưa thu (không hủy): '+money(unpaidValue),'Tổng giá trị đơn không hủy, gồm chưa thu: '+money(revenue+unpaidValue),'',
 'Đơn cao nhất (đã thanh toán):',''+describe(highest),'','Đơn thấp nhất (đã thanh toán):',''+describe(lowest),'',
 'Đơn hoàn thanh toán chưa thu lại không được tính vào doanh thu.','https://thanson1998.github.io/trainghiemdpa/'].join('\n');
 return {text,from,to,totalOrders:rows.length,cancelledOrders:cancelled.length,paidOrders:paid.length,unpaidOrders:unpaid.length,guests,revenue,unpaidValue,nonCancelledValue:revenue+unpaidValue,highest,lowest};
}
export async function readMonthlyRevenue(db:D1Database,now:number){
 const date=vietnamClock(now).date,from=date.slice(0,7)+'-01';
 const {results}=await db.prepare("SELECT r.*,p.total AS payment_total,p.paid_at FROM reservations r LEFT JOIN booking_payments p ON p.booking_id=r.id WHERE r.user_id='dpa-shared' AND r.date>=? AND r.date<=? ORDER BY r.date,r.id").bind(from,date).all<any>();
 return monthlyRevenueSummary(results.map(r=>({booking:paymentBooking(r),...(r.paid_at?{paymentTotal:r.payment_total}:{})})),now);
}

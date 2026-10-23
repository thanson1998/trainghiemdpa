import {z} from 'zod';
import type {Booking} from './model';
const out=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function paymentBooking(r:any):Booking{return {id:r.id,orderCode:r.order_code,date:r.date,start:r.start,end:r.end,name:r.name,phone:r.phone,tables:JSON.parse(r.table_ids),people:r.people,...(r.total_people!=null?{totalPeople:r.total_people}:{}),priceMode:r.price_mode??'agreed',platters:r.platters,price:r.price,deposit:r.deposit??0,menu:r.menu,note:r.note,status:r.status,version:r.version};}
export async function GET_PAYMENTS(req:Request,db:D1Database){
 const p=new URL(req.url).searchParams,month=p.get('month');
 if(!month||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return out({error:'Chọn tháng thanh toán hợp lệ.'},400);
 try{const {results}=await db.prepare('SELECT * FROM booking_payments WHERE booking_date>=? AND booking_date<=? ORDER BY paid_at DESC').bind(month+'-01',month+'-31').all<any>();
 return out({payments:results.map(r=>({booking:JSON.parse(r.snapshot),total:r.total,deposit:r.deposit,received:r.received,tendered:r.tendered,method:r.method,paidAt:r.paid_at}))});
 }catch{return out({error:'Chưa tải được thanh toán. Hãy thử lại.'},503);}
}
export async function PAY(req:Request,db:D1Database){
 try{
 const input=z.object({id:z.string().uuid(),version:z.number().int().positive(),total:z.number().int().min(0),deposit:z.number().int().min(0),tendered:z.number().int().min(0).max(5000000000),method:z.enum(['cash','transfer'])}).safeParse(await req.json());
 if(!input.success)return out({error:'Kiểm tra số tiền và phương thức thanh toán.'},400);
 const b=input.data;const {results}=await db.prepare('SELECT * FROM reservations WHERE id=? AND user_id=?').bind(b.id,'dpa-shared').all<any>();const r=results[0];
 if(!r)return out({error:'Không tìm thấy đơn.'},404);
 const booking=paymentBooking(r),total=booking.price*booking.tables.length,deposit=booking.deposit??0,due=total-deposit;
 if(r.version!==b.version||total!==b.total||deposit!==b.deposit)return out({error:'Đơn vừa thay đổi. Tải lại và kiểm tra số tiền trước khi thanh toán.'},409);
 if(booking.status==='cancelled')return out({error:'Đơn đã hủy không thể thanh toán.'},409);
 if(deposit>total||b.tendered<due||(b.method==='transfer'&&b.tendered!==due))return out({error:'Tiền nhận chưa đủ hoặc không đúng số cần thu. Chuyển khoản cần nhập đúng số tiền còn lại.'},400);
 const paidAt=new Date().toISOString();
 const result=await db.prepare(`INSERT INTO booking_payments(booking_id,booking_date,booking_version,total,deposit,received,tendered,method,snapshot,paid_at)
 SELECT id,date,version,?,?,?,?,?,?,? FROM reservations WHERE id=? AND user_id=? AND version=? AND status<>'cancelled'
 AND NOT EXISTS(SELECT 1 FROM booking_payments WHERE booking_id=?)`).bind(total,deposit,due,b.tendered,b.method,JSON.stringify(booking),paidAt,b.id,'dpa-shared',b.version,b.id).run();
 if(!result.meta.changes)return out({error:'Đơn đã thanh toán hoặc vừa thay đổi. Tải lại để kiểm tra, không thu thêm lần nữa.'},409);
 return out({ok:true,payment:{booking,total,deposit,received:due,tendered:b.tendered,method:b.method,paidAt}});
 }catch{return out({error:'Chưa xác nhận được thanh toán. Tải lại danh sách để kiểm tra trước khi thử lại.'},503);}
}

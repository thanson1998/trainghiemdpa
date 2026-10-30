import {paymentBooking} from './payments-api';
import {bookingTotal} from './model';
import {validSalesRange,utcSalesRange} from './sales-date';
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
export async function GET_ORDER_HISTORY(req:Request,db:D1Database){
 const p=new URL(req.url).searchParams,from=p.get('from')||'',to=p.get('to')||'',dateBy=p.get('dateBy')||'paidAt',status=p.get('status')||'all',query=(p.get('q')||'').trim(),page=Number(p.get('page')||1);
 if(!validSalesRange(from,to)||!['paidAt','bookingDate'].includes(dateBy)||!['all','paid','paid_cancelled','unpaid','cancelled','reopened'].includes(status)||!Number.isSafeInteger(page)||page<1||query.length>200)return Response.json({error:'Kiểm tra khoảng ngày, trạng thái và từ khóa tra cứu.'},{status:400});
 try{
  const utc=utcSalesRange(from,to),where=dateBy==='paidAt'?'((p.paid_at>=? AND p.paid_at<?) OR (p.booking_id IS NULL AND r.date>=? AND r.date<=?))':'r.date>=? AND r.date<=?';
  const args=dateBy==='paidAt'?[utc.from,utc.to,from,to]:[from,to];
  const {results}=await db.prepare("SELECT r.*,p.paid_at,p.snapshot AS payment_snapshot,p.total AS payment_total,p.deposit AS payment_deposit,p.received,p.tendered,p.method,EXISTS(SELECT 1 FROM payment_reversals x WHERE x.booking_id=r.id) AS has_reversal FROM reservations r LEFT JOIN booking_payments p ON p.booking_id=r.id WHERE r.user_id='dpa-shared' AND "+where+" ORDER BY COALESCE(p.paid_at,r.updated_at) DESC,r.id DESC").bind(...args).all<any>();
  const rows=results.map(r=>({booking:{...paymentBooking(r),...(r.paid_at?{paidAt:r.paid_at}:{}),updatedAt:r.updated_at},reopened:!!r.has_reversal&&!r.paid_at&&r.status!=='cancelled',...(r.payment_snapshot?{payment:{booking:JSON.parse(r.payment_snapshot),total:r.payment_total,deposit:r.payment_deposit,received:r.received,tendered:r.tendered,method:r.method,paidAt:r.paid_at}}:{})})).filter(row=>{
   const b=row.booking;if(status==='paid_cancelled'&&!row.payment&&b.status!=='cancelled')return false;
   if(status==='paid'&&!row.payment||status==='unpaid'&&(row.payment||b.status==='cancelled')||status==='cancelled'&&b.status!=='cancelled'||status==='reopened'&&!row.reopened)return false;
   return !query||fold([b.orderCode,b.name,b.phone,...b.tables,b.serviceType==='takeaway'?'mang về':''].join(' ')).includes(fold(query));
  });
  return Response.json({rows:rows.slice((page-1)*30,page*30),count:rows.length,page,total:rows.reduce((n,row)=>n+(row.booking.status==='cancelled'?0:bookingTotal(row.booking)),0)},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Chưa tải được lịch sử đơn. Vui lòng thử lại.'},{status:503});}
}

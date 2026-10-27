import type {Booking} from './model';
import type {Payment} from './payments-panel';
import {posDirty,type PosTicket} from './pos-logic';

export async function reopenPosOrder(payment:Payment,getTickets:()=>PosTicket[],request:(path:string,options?:RequestInit)=>Promise<Response>,reason:string):Promise<Booking>{
 if(!reason.trim())throw Error('Nhập lý do hoàn đơn để lưu vào lịch sử.');
 if(getTickets().some(t=>t.booking.id===payment.booking.id&&posDirty(t)))throw Error('Phiếu này có thay đổi chưa lưu trong POS. Mở phiếu để kiểm tra trước khi hoàn đơn.');
 const response=await request('/api/payments/reverse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:payment.booking.id,version:payment.booking.version+1,paidAt:payment.paidAt,reason:reason.trim()})});
 const data=await response.json() as {error?:string;booking:Booking};
 if(!response.ok)throw Error(data.error||'Chưa hoàn đơn được. Tải lại lịch sử để kiểm tra trước khi thử lại.');
 return data.booking;
}

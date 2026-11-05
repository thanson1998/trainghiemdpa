import type {Booking} from './model';
import {posFingerprint,type PosTicket} from './pos-logic';

// A server acknowledgement advances the version without replacing edits made while saving.
export function acknowledgePosSave(ticket:PosTicket,submitted:Booking,saved:Booking):PosTicket{
 if(ticket.booking.id!==submitted.id||ticket.booking.paidAt||ticket.booking.status==='cancelled')return ticket;
 if(ticket.booking.version!==submitted.version&&ticket.booking.version!==saved.version)return ticket;
 const unchanged=posFingerprint(ticket.booking)===posFingerprint(submitted)||ticket.saved===posFingerprint(ticket.booking);
 const booking=unchanged?saved:{...ticket.booking,version:saved.version,...(saved.orderCode?{orderCode:saved.orderCode}:{}),...(saved.updatedAt?{updatedAt:saved.updatedAt}:{})};
 return {...ticket,booking,saved:posFingerprint(saved)};
}

export async function savePosInBackground(submitted:Booking,request:(path:string,options?:RequestInit)=>Promise<Response>,acknowledge:(saved:Booking)=>void){
 const response=await request('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(submitted)});
 const result=await response.json() as {error?:string;version:number};
 if(!response.ok)throw Error(result.error||'Chưa tự động lưu được đơn.');
 const saved={...submitted,version:result.version};
 // Retain the acknowledged version even if the follow-up read loses its connection.
 acknowledge(saved);
 const check=await request('/api/bookings?date='+submitted.date,{cache:'no-store'});
 if(!check.ok)throw Error('Đã gửi đơn nhưng chưa kiểm tra được bản lưu. Kiểm tra kết nối rồi thử lại.');
 const data=await check.json() as {bookings:Booking[]};
 const current=data.bookings.find(row=>row.id===submitted.id);
 if(!current||current.version!==saved.version||current.paidAt||current.status==='cancelled')throw Error('Đơn vừa thay đổi trên thiết bị khác. Kiểm tra bản máy chủ trước khi tiếp tục.');
 acknowledge(current);
 return data.bookings;
}

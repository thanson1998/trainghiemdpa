import type {Booking} from './model';
import {posDirty,type PosTicket} from './pos-logic';
type Requester=(path:string,options?:RequestInit)=>Promise<Response>;
export async function cancelPosOrder(selected:Booking,getTickets:()=>PosTicket[],request:Requester):Promise<Booking>{
 const checkDraft=()=>{if(getTickets().some(t=>t.booking.id===selected.id&&posDirty(t)))throw Error('Phiếu có thay đổi chưa lưu. Mở phiếu để lưu hoặc bỏ nháp trước khi hủy.');};
 checkDraft();
 const response=await request('/api/bookings?date='+encodeURIComponent(selected.date),{cache:'no-store'});
 const data=await response.json() as {bookings?:Booking[];error?:string};
 if(!response.ok)throw Error(data.error||'Chưa kiểm tra được phiếu. Vui lòng thử lại.');
 const current=data.bookings?.find(row=>row.id===selected.id);
 if(!current)throw Error('Phiếu đã bị xóa hoặc đổi ngày. Tải lại danh sách để kiểm tra.');
 if(current.paidAt)throw Error('Phiếu đã thanh toán. Không thể hủy từ danh sách đơn đang mở.');
 checkDraft();
 if(current.status==='cancelled')return current;
 if(current.version!==selected.version)throw Error('Phiếu vừa thay đổi trên thiết bị khác. Đóng hộp này và tải lại danh sách trước khi hủy.');
 const cancelled={...current,status:'cancelled' as const};
 const saved=await request('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...cancelled,action:'cancel-open-order'})});
 const result=await saved.json() as {version?:number;error?:string};
 if(!saved.ok)throw Error(result.error||'Chưa hủy được phiếu. Tải lại để kiểm tra rồi thử lại.');
 if(!Number.isInteger(result.version))throw Error('Chưa xác nhận được kết quả hủy. Tải lại danh sách để kiểm tra.');
 return {...cancelled,version:result.version!};
}

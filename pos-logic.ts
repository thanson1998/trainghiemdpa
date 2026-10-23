import {today,type Booking} from './model';
import {readMenu,readMenuSet,writeMenu,mergeMenuItems,itemQuantity,menuSetQuantity,validMenu,type MenuItem} from './menu';
import {updateBookingDraft} from './booking-logic';
export const posFold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().trim();
export function newPosBooking(date=today()):Booking{
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const minutes=Math.min(1438,Number(parts.find(p=>p.type==='hour')?.value)*60+Number(parts.find(p=>p.type==='minute')?.value));
 const time=(n:number)=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 return {id:crypto.randomUUID(),date,start:time(minutes),end:time(Math.min(1439,minutes+180)),name:'Khách lẻ',phone:'',tables:[],people:1,totalPeople:1,platters:1,price:0,priceMode:'auto',deposit:0,menu:'',note:'',status:'arrived',version:0};
}
const explicitSet=(b:Booking)=>{const set=readMenuSet(b.menu);return set?{...set,quantity:menuSetQuantity(b.menu,b.tables.length)}:undefined;};
export function posAppend(b:Booking,added:MenuItem[]):Booking{
 const previous=readMenu(b.menu,b.tables.length);if(added.some(a=>!a.included&&previous.some(p=>p.included&&posFold(p.name)===posFold(a.name))))throw Error('Món này đã nằm trong set. Để gọi thêm ngoài giá set, dùng Món ngoài thư viện với tên phân biệt, ví dụ Gà gọi thêm.');
 const items=mergeMenuItems([...previous,...added]);
 const menu=writeMenu(items,explicitSet(b));if(items.length>80||!validMenu(menu))throw Error('Mỗi phiếu tối đa 80 món, số lượng mỗi món tối đa 1,000.');
 return updateBookingDraft(b,'menu',menu);
}
export function posEditItem(b:Booking,index:number,patch:Partial<MenuItem>):Booking{
 const items=readMenu(b.menu,b.tables.length).map((i,n)=>n===index?{...i,...patch}:i);
 return updateBookingDraft(b,'menu',writeMenu(items,explicitSet(b)));
}
export const posFingerprint=(b:Booking)=>JSON.stringify(b);
export function posIssue(b:Booking){
 if(b.paidAt)return 'Đơn đã thanh toán. Mở tab Thanh toán để in lại phiếu.';
 if(!b.name.trim())return 'Nhập tên khách.';
 if(!b.tables.length)return 'Chọn ít nhất một bàn trước khi lưu.';
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.end))return 'Nhập giờ theo định dạng 24h, ví dụ 18:00.';
 if(b.end<=b.start)return 'Giờ kết thúc phải sau giờ bắt đầu (trong cùng ngày).';
 if(!readMenu(b.menu).some(i=>i.name.trim()))return 'Chọn ít nhất một món.';
 if(!validMenu(b.menu))return 'Kiểm tra tên món, số lượng và đơn giá.';
 if(b.priceMode!=='agreed'&&readMenu(b.menu).some(i=>!i.included&&i.price===null))return 'Nhập đủ giá món hoặc chọn giữ giá đã chốt.';
 if((b.deposit??0)>b.price*b.tables.length)return 'Tiền cọc đang lớn hơn tổng đơn. Kiểm tra giá hoặc tiền cọc.';
 return '';
}
export const posCategory=(name:string)=>{const n=posFold(name);return /bia|nuoc|ca phe|cafe|tra |sinh to|sua chua|ruou/.test(n)?'Đồ uống':/bim bim|huong duong|kho ga|an vat|khoai tay chien/.test(n)?'Ăn vặt':'Món ăn';};
export type PosTicket={booking:Booking;saved:string};
export const posDirty=(t:PosTicket)=>t.saved!==posFingerprint(t.booking);
export function openPosTicket(state:{tickets:PosTicket[];selected:string},booking:Booking){
 const existing=state.tickets.find(t=>t.booking.id===booking.id);
 const next={booking:{...booking,tables:[...booking.tables]},saved:posFingerprint(booking)};
 return {tickets:existing?state.tickets.map(t=>t.booking.id===booking.id&&!posDirty(t)?next:t):[...state.tickets,next],selected:booking.id};
}
export function readPosTickets(raw:string|null):{tickets:PosTicket[];selected:string}|null{
 try{const j=JSON.parse(raw||'null');if(j?.format!=='DPA_POS_V1'||!Array.isArray(j.tickets))return null;
 const tickets=j.tickets.filter((t:any)=>t?.booking&&typeof t.booking.id==='string'&&typeof t.booking.menu==='string'&&Array.isArray(t.booking.tables)&&typeof t.saved==='string'&&typeof t.booking.date==='string'&&typeof t.booking.version==='number');
 return tickets.length?{tickets,selected:tickets.some((t:PosTicket)=>t.booking.id===j.selected)?j.selected:tickets[0].booking.id}:null;
 }catch{return null;}
}

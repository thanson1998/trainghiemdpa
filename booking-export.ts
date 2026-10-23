import {guestCount,balanceDue,statusNames,type Booking} from './model';
import {menuText} from './menu';

export function bookingCsv(bookings:Booking[]){
 const cell=(value:unknown)=>{let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 const rows:unknown[][]=[['Ngày','Khách đặt','Điện thoại','Bàn','Bắt đầu','Kết thúc','Tổng số khách','Giá/bàn','Tổng tiền','Đã cọc','Còn lại','Món ăn','Trạng thái','Ghi chú'],...bookings.map(b=>[b.date,b.name,b.phone,b.tables.join(', '),b.start,b.end,guestCount(b),b.price,b.price*b.tables.length,b.deposit??0,balanceDue(b),menuText(b.menu),statusNames[b.status],b.note])];
 return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}

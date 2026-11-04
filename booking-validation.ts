import {bookingTotal,guestCount,isTakeaway,validTableLabel,type Booking} from './model';
export type BookingField= 'name'|'phone'|'date'|'start'|'end'|'tableLabel'|'tables'|'totalPeople'|'price'|'deposit';
export type BookingFieldErrors=Partial<Record<BookingField,string>>;
export function bookingFieldErrors(b:Booking):BookingFieldErrors{
 const errors:BookingFieldErrors={};
 if(!b.name?.trim()||b.name.length>100)errors.name='Nhập tên khách từ 1 đến 100 ký tự.';
 if((b.phone??'').length>30)errors.phone='Số điện thoại tối đa 30 ký tự.';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||Number.isNaN(Date.parse(b.date))||new Date(b.date).toISOString().slice(0,10)!==b.date)errors.date='Chọn ngày phục vụ hợp lệ.';
 const time=(s:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
 if(!time(b.start))errors.start='Nhập giờ theo định dạng 24h, ví dụ 18:00.';
 if(!time(b.end))errors.end='Nhập giờ theo định dạng 24h, ví dụ 21:00.';
 else if(time(b.start)&&b.end<=b.start)errors.end='Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.';
 if(!validTableLabel(b.tableLabel??''))errors.tableLabel='Nhập số thẻ 1–9999, cách nhau bằng dấu phẩy, không lặp số.';
 if(!isTakeaway(b)&&!b.tables.length)errors.tables='Chọn ít nhất một bàn trước khi lưu.';
 const guests=guestCount(b);if(!Number.isInteger(guests)||guests<1||guests>50000)errors.totalPeople='Số khách phải là số nguyên từ 1 đến 50.000.';
 if(!Number.isInteger(b.price)||b.price<0||b.price>100000000)errors.price='Giá phải từ 0 đến 100.000.000 đồng.';
 const deposit=b.deposit??0;if(!Number.isInteger(deposit)||deposit<0||deposit>4800000000)errors.deposit='Nhập số tiền cọc hợp lệ.';
 else if(deposit>bookingTotal(b))errors.deposit='Tiền cọc không được lớn hơn tổng đơn.';
 return errors;
}
export function focusBookingField(root:Pick<ParentNode,'querySelector'>,errors:BookingFieldErrors){
 const key=Object.keys(errors)[0];if(!key)return;
 const field=root.querySelector<HTMLElement>('[data-booking-field="'+key+'"]');field?.focus();field?.scrollIntoView({block:'nearest',behavior:'smooth'});
}

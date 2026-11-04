import {bookingFieldErrors} from './booking-validation';
import {FieldError} from './field-error';
import type {Booking} from './model';
import {isTakeaway} from './model';
import {TimeInput} from './time-input';
import {PriceInput} from './price-input';
import {PortableTableField} from './portable-table-field';
type Props={booking:Booking;disabled?:boolean;onChange:(key:keyof Booking,value:unknown)=>void};
export function PosScheduleFields({booking:b,disabled,onChange}:Props){
 const errors=bookingFieldErrors(b);
 return <fieldset className="pos-inline-schedule" disabled={disabled}><label>Ngày phục vụ<input data-booking-field="date" aria-invalid={!!errors.date} aria-label="Ngày phục vụ POS" type="date" value={b.date} onChange={e=>{if(e.target.value)onChange('date',e.target.value);}}/><FieldError message={errors.date}/></label><label>Bắt đầu<TimeInput data-booking-field="start" aria-invalid={!!errors.start} aria-label="Giờ bắt đầu POS" placeholder="18:00" value={b.start} onChange={value=>onChange('start',value)}/><FieldError message={errors.start}/></label><div className="pos-end-table-pair"><label>Kết thúc<TimeInput data-booking-field="end" aria-invalid={!!errors.end} aria-label="Giờ kết thúc POS" placeholder="21:00" value={b.end} onChange={value=>onChange('end',value)}/><FieldError message={errors.end}/></label><PortableTableField compact booking={b} disabled={disabled} onChange={onChange}/></div></fieldset>;
}
export function PosPriceMode({booking:b,disabled,onChange}:Props){
 return <fieldset className="pos-header-price-mode" disabled={disabled}><label>Cách tính giá<select aria-label="Cách tính giá POS" value={b.priceMode??'agreed'} onChange={e=>onChange('priceMode',e.target.value)}><option value="auto">Tính theo món / set</option><option value="agreed">Giữ giá đã chốt</option></select></label><label>Đã cọc<PriceInput label="Tiền cọc POS" field="deposit" max={4800000000} value={b.deposit??0} onChange={v=>onChange('deposit',v??0)}/><FieldError message={bookingFieldErrors(b).deposit}/></label><label>Trạng thái phục vụ<select aria-label="Trạng thái POS" value={b.status} onChange={e=>onChange('status',e.target.value)}><option value="reserved">Đã đặt</option><option value="arrived">Đang phục vụ</option><option value="completed">Hoàn tất</option>{b.status==='cancelled'&&<option value="cancelled" disabled>Đã hủy</option>}</select></label></fieldset>;
}
export function PosPricingFields({booking:b,disabled,onChange,hideMode=false}:Props&{hideMode?:boolean}){
 return <fieldset className="pos-inline-pricing" disabled={disabled}>{!hideMode&&<label>Cách tính giá<select aria-label="Cách tính giá POS" value={b.priceMode??'agreed'} onChange={e=>onChange('priceMode',e.target.value)}><option value="auto">Tính theo món / set</option><option value="agreed">Giữ giá đã chốt</option></select></label>}{b.priceMode==='agreed'&&<label>{isTakeaway(b)?'Giá đã chốt / đơn':'Giá đã chốt / bàn'}<PriceInput label="Giá chốt POS mỗi bàn" field="price" value={b.price} onChange={v=>onChange('price',v??0)}/></label>}{!hideMode&&<><label>Đã cọc<PriceInput label="Tiền cọc POS" max={4800000000} value={b.deposit??0} onChange={v=>onChange('deposit',v??0)}/></label><label>Trạng thái<select aria-label="Trạng thái POS" value={b.status} onChange={e=>onChange('status',e.target.value)}><option value="reserved">Đã đặt</option><option value="arrived">Đang phục vụ</option><option value="completed">Hoàn tất</option>{b.status==='cancelled'&&<option value="cancelled" disabled>Đã hủy</option>}</select></label></>}</fieldset>;
}

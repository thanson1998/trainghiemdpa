import {isTakeaway,normalizeTableLabel,type Booking} from './model';
import './portable-table.css';
export function PortableTableField({booking,disabled=false,onChange,compact=false}:{booking:Booking;disabled?:boolean;onChange:(key:keyof Booking,value:unknown)=>void;compact?:boolean}){
 if(isTakeaway(booking))return null;
 return <label className={'portable-table-field'+(compact?' portable-table-compact':'')}>Số Bàn<input aria-label="Số Bàn" autoComplete="off" type="text" maxLength={500} placeholder={compact?'12':'VD: 12 hoặc 12, 13'} value={booking.tableLabel??''} disabled={disabled} onChange={e=>onChange('tableLabel',e.target.value)} onBlur={e=>onChange('tableLabel',normalizeTableLabel(e.target.value))}/>{!compact&&<small>Nhập số trên biển bàn của khách; có thể để trống khi đặt trước.</small>}</label>;
}

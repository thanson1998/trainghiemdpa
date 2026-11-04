import {isTakeaway,normalizeTableLabel,tableIds,type Booking} from './model';
import './portable-table.css';
export function PortableTableField({booking,disabled=false,onChange}:{booking:Booking;disabled?:boolean;onChange:(key:keyof Booking,value:unknown)=>void}){
 if(isTakeaway(booking))return null;
 const list='portable-tables-'+booking.id;
 return <label className="portable-table-field">Số bàn khách mang theo<input aria-label="Số bàn khách mang theo" list={list} autoComplete="off" type="text" maxLength={500} placeholder="VD: 12 hoặc 12, 13" value={booking.tableLabel??''} disabled={disabled} onChange={e=>onChange('tableLabel',e.target.value)} onBlur={e=>onChange('tableLabel',normalizeTableLabel(e.target.value))}/><datalist id={list}>{Array.from({length:Math.max(100,tableIds.length)},(_,i)=><option key={i+1} value={String(i+1)}/>)}</datalist><small>Nhập số trên biển bàn của khách; có thể để trống khi đặt trước.</small></label>;
}

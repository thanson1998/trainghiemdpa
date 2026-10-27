import {useSyncExternalStore} from 'react';
import {today} from './model';
import {monthRange,validSalesRange,type SalesDateFilter} from './sales-date';
import './sales-ux.css';
const key='dpa-sales-date-filter-v1',listeners=new Set<()=>void>();
let state:SalesDateFilter={...monthRange(today().slice(0,7)),dateBy:'paidAt'};
try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved&&validSalesRange(saved.from,saved.to)&&['paidAt','bookingDate'].includes(saved.dateBy))state=saved;}catch{}
export function setSalesFilter(next:SalesDateFilter){state=next;try{sessionStorage.setItem(key,JSON.stringify(next));}catch{}listeners.forEach(fn=>fn());}
export function useSalesFilter(){return [useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>state),setSalesFilter] as const;}
export function SalesDateFilters({disabled=false}:{disabled?:boolean}){
 const [f,set]=useSalesFilter();return <div className="sales-date-filters"><label>Lọc theo<select aria-label="Loại ngày tra cứu" disabled={disabled} value={f.dateBy} onChange={e=>set({...f,dateBy:e.target.value as SalesDateFilter['dateBy']})}><option value="paidAt">Ngày thanh toán</option><option value="bookingDate">Ngày đặt / phục vụ</option></select></label><label>Từ ngày<input type="date" aria-label="Tra cứu từ ngày" disabled={disabled} value={f.from} onChange={e=>set({...f,from:e.target.value})}/></label><label>Đến ngày<input type="date" aria-label="Tra cứu đến ngày" disabled={disabled} value={f.to} onChange={e=>set({...f,to:e.target.value})}/></label><button type="button" className="secondary-btn" disabled={disabled} onClick={()=>set({...f,from:today(),to:today()})}>Hôm nay</button><button type="button" className="secondary-btn" disabled={disabled} onClick={()=>set({...f,...monthRange(today().slice(0,7))})}>Tháng này</button>{!validSalesRange(f.from,f.to)&&<p role="alert" className="form-error">Chọn khoảng ngày hợp lệ, tối đa 367 ngày.</p>}</div>;
}

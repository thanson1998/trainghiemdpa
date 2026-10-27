import {useCallback,useEffect,useRef,useState} from 'react';
import {money,orderLocation,today} from './model';
import {posFold} from './pos-logic';
import {apiRequest} from './sync';
import {watchLiveSync} from './live-sync';
import type {Payment} from './payments-panel';
import './pos-sales-history.css';
const paidDay=(p:Payment)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(p.paidAt));
const stamp=(value:string)=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false});
export function PosSalesHistory({query,onReceipt}:{query:string;onReceipt:(p:Payment)=>void}){
 const [month,setMonth]=useState(()=>today().slice(0,7)),[day,setDay]=useState('');
 const [payments,setPayments]=useState<Payment[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const sequence=useRef(0);
 const load=useCallback(async(background=false)=>{
  const current=++sequence.current;if(!background)setLoading(true);
  try{const r=await apiRequest('/api/payments?'+new URLSearchParams({month,dateBy:'paidAt'}));const data=await r.json() as {payments:Payment[];error?:string};if(!r.ok)throw Error(data.error||'Chưa tải được lịch sử bán hàng.');if(current===sequence.current){setPayments(data.payments);setError('');}}
  catch(e){if(current===sequence.current)setError(e instanceof Error?e.message:'Chưa tải được lịch sử bán hàng.');}
  finally{if(current===sequence.current)setLoading(false);}
 },[month]);
 useEffect(()=>{setPayments([]);void load();const stop=watchLiveSync(()=>load(true));return()=>{stop();sequence.current++;};},[load]);
 const rows=payments.filter(p=>(!day||paidDay(p)===day)&&(!query.trim()||posFold([p.booking.orderCode,p.booking.name,p.booking.phone,orderLocation(p.booking)].join(' ')).includes(posFold(query)))).sort((a,b)=>b.paidAt.localeCompare(a.paidAt));
 return <section className="pos-sales-history" aria-label="Lịch sử đơn bán hàng POS">
  <div className="pos-sales-filters"><label>Tháng thanh toán<input aria-label="Tháng lịch sử bán hàng" type="month" value={month} onChange={e=>{if(e.target.value){setMonth(e.target.value);setDay('');}}}/></label><label>Ngày thanh toán<input aria-label="Ngày lịch sử bán hàng" type="date" value={day} onChange={e=>{setDay(e.target.value);if(e.target.value)setMonth(e.target.value.slice(0,7));}}/></label><button className="secondary-btn" onClick={()=>{setMonth(today().slice(0,7));setDay(today());}}>Hôm nay</button><button className="secondary-btn" onClick={()=>setDay('')}>Cả tháng</button><button className="secondary-btn" disabled={loading} onClick={()=>void load()}>Tải lại</button></div>
  <p className="pos-sales-summary"><b>{rows.length} đơn đã thanh toán</b><span>Tổng tiền <strong>{money(rows.reduce((sum,p)=>sum+p.total,0))}</strong></span></p>
  <p className="field-help">Theo ngày thu tiền · Đơn mới nhất ở trên · Chọn đơn để xem và in lại phiếu.</p>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {loading?<p role="status">Đang tải lịch sử bán hàng…</p>:rows.length?<div className="pos-sales-list">{rows.map(p=><button type="button" className="pos-sales-row" key={p.booking.id} onClick={()=>onReceipt(p)} aria-label={'Xem hóa đơn '+(p.booking.orderCode||p.booking.name)}><span><b>{p.booking.orderCode||p.booking.id}</b><span>{p.booking.name} · {orderLocation(p.booking)}</span><small>{stamp(p.paidAt)}</small></span><span><strong>{money(p.total)}</strong><small>{p.method==='cash'?'Tiền mặt':'Chuyển khoản'}</small><b className="pos-sales-view">Xem / in lại</b></span></button>)}</div>:!error&&<p className="pos-no-results">Chưa có đơn đã thanh toán phù hợp. Thử chọn Cả tháng hoặc tháng khác.</p>}
 </section>;
}

import {MapKitchen} from './map-kitchen';
import {MapStage} from './map-stage';
import {zones,customZone,type Booking} from './model';
import {useEffect,useState} from 'react';
import {apiRequest} from './sync';
import {Check} from 'lucide-react';
import {posFold} from './pos-logic';
import './table-map-picker.css';

export function TableMapPicker({booking,bookings,onChange,disabled=false,zone='all',query='',fetchBookings=false}:{booking:Booking;bookings:Booking[];onChange:(tables:string[])=>void;disabled?:boolean;zone?:string;query?:string;fetchBookings?:boolean}){
 const [loaded,setLoaded]=useState<{date:string;rows:Booking[]}>(),[failure,setFailure]=useState('');
 useEffect(()=>{
  if(!fetchBookings)return;
  let active=true;
  setLoaded(undefined);setFailure('');
  async function refresh(){try{const r=await apiRequest('/api/bookings?date='+booking.date,{cache:'no-store'}),j=await r.json() as {bookings:Booking[];error:string};if(!r.ok)throw Error(j.error||'Chưa tải được lịch bàn.');if(active){setLoaded({date:booking.date,rows:j.bookings});setFailure('');}}catch(e){if(active)setFailure(e instanceof Error?e.message:'Chưa tải được lịch bàn.');}}
  void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},10000);
  return()=>{active=false;clearInterval(timer);};
 },[fetchBookings,booking.date]);
 const waiting=fetchBookings&&loaded?.date!==booking.date;
 const locked=disabled||waiting||!!failure;
 const conflicts=(fetchBookings?loaded?.rows??[]:bookings).filter(row=>row.id!==booking.id&&row.date===booking.date&&row.status!=='cancelled'&&!row.paidAt&&row.start<booking.end&&row.end>booking.start);
 const shown=zones.filter(z=>(zone==='all'||z.id===zone)&&(!query||z.tables.some(id=>posFold(id+' '+z.title).includes(posFold(query)))));
 return <div className="mini-table-picker" aria-busy={waiting}>
  {failure?<p className="form-error" role="alert">{failure} Đang thử tải lại lịch bàn…</p>:waiting&&<p className="field-help" role="status">Đang kiểm tra lịch bàn theo ngày đã chọn…</p>}
  <div className="mini-map-legend"><span><i/>Trống</span><span><i className="picked"/>Đã chọn</span><span><i className="occupied"/>Trùng giờ</span><b>{booking.tables.length} bàn đã chọn</b></div>
  <div className="mini-map-scroll"><div className={'mini-floor-map '+(zone!=='all'?'mini-single-zone':'')} role="group" aria-label="Sơ đồ chọn bàn thu nhỏ">
   {shown.map(z=><section className={'mini-zone mini-zone-'+z.id+(customZone(z.id)?' mini-zone-custom':'')} key={z.id}><h3>{z.title}</h3><div className="mini-zone-tables">{z.tables.map(id=>{
    const picked=booking.tables.includes(id),other=conflicts.filter(row=>row.tables.includes(id)),taken=other.length>0;
    const match=!query||posFold(id+' '+z.title).includes(posFold(query));
    return <button type="button" key={id} className={(picked?'picked ':taken?'occupied ':'')+(!match?'dimmed':'')} aria-pressed={picked} aria-label={'Bàn '+id+' · '+z.title+(picked?' · đã chọn':'')+(taken?' · trùng giờ':'')} title={taken?'Trùng giờ: '+other.map(row=>row.name+' ('+row.start+'–'+row.end+')').join(', '):z.title+' · Bàn '+id} disabled={locked||!match||(!picked&&taken)} onClick={()=>onChange(picked?booking.tables.filter(t=>t!==id):[...booking.tables,id])}>{picked&&<Check size={11}/>}<span>{id}</span></button>;
   })}</div></section>)}
   {zone==='all'&&<><MapStage/><MapKitchen/><div className="mini-map-path">LỐI ĐI</div><div className="mini-map-counter">Quầy thanh toán</div><div className="mini-map-entrance">Lối vào ↑</div></>}
  </div></div>
  {!shown.length&&<p className="field-help">Không tìm thấy bàn phù hợp.</p>}
  {booking.tables.length>0&&<p className="mini-selected-tables" aria-live="polite">Đã chọn: <b>{booking.tables.join(', ')}</b></p>}
 </div>;
}

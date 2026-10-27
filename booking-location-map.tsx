import {MapStage} from './map-stage';
import {zones,customZone,type Booking} from './model';
import {MapPin} from 'lucide-react';
import './booking-location-map.css';

export function BookingLocationMap({booking}:{booking:Booking}){
 const selected=new Set(booking.tables);
 return <aside className="booking-location-map" aria-label="Vị trí bàn của phiếu">
  <header><div><MapPin size={18}/><h2>Vị trí bàn đặt</h2></div><span>{selected.size} bàn</span></header>
  <div className="booking-location-body">
   <div className="booking-location-summary" aria-live="polite">{selected.size?zones.filter(z=>z.tables.some(id=>selected.has(id))).map(z=><div key={z.id}><b>{z.title}</b><span>{z.tables.filter(id=>selected.has(id)).map(id=>'Bàn '+id).join(' · ')}</span></div>):<p>Phiếu chưa chọn bàn. Nhấn “Chọn bàn” để đặt vị trí.</p>}</div>
   <div className="booking-location-legend"><span><i/>Bàn của phiếu này</span><span><i/>Bàn khác</span></div>
   <div className="booking-location-floor"><div className="mini-floor-map" aria-label="Sơ đồ vị trí các bàn đã đặt">
    {zones.map(z=><section key={z.id} className={'mini-zone mini-zone-'+z.id+(customZone(z.id)?' mini-zone-custom':'')}><h3>{z.title}</h3><div className="mini-zone-tables">{z.tables.map(id=><span key={id} className={'booking-location-table'+(selected.has(id)?' selected':'')} aria-label={'Bàn '+id+(selected.has(id)?' · thuộc phiếu đang mở':'')}><b>{id}</b></span>)}</div></section>)}
    <MapStage/><div className="mini-map-path">LỐI ĐI</div><div className="mini-map-counter">Quầy thanh toán</div><div className="mini-map-entrance">Lối vào ↑</div>
   </div></div>
   <p className="booking-location-help">Bàn tô xanh thuộc phiếu đang mở. Sơ đồ hiển thị vị trí; dùng “Chọn bàn” để chỉnh sửa.</p>
  </div>
 </aside>;
}

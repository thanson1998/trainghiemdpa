import {RestaurantFacilities} from './restaurant-facilities';
import {mapZones,tableNumber} from './model';
import {MapCashier} from './map-cashier';
import {MapKitchen} from './map-kitchen';
import {MapStage} from './map-stage';
import {zones,customZone,portableTableText,type Booking} from './model';
import {MapPin,LogIn,Armchair} from 'lucide-react';
import './booking-location-map.css';

export function BookingLocationMap({booking}:{booking:Booking}){
 const selected=new Set(booking.tables);
 return <aside className="booking-location-map" aria-label="Vị trí bàn của phiếu">
  <header><div><MapPin size={18}/><h2>Vị trí bàn đặt</h2></div><span>{selected.size} bàn</span></header>
  <div className="booking-location-body">
   <div className="booking-location-summary" aria-live="polite">{selected.size?zones.filter(z=>z.tables.some(id=>selected.has(id))).map(z=><div key={z.id}><b>{z.title}</b><span>{portableTableText(booking)} · {z.tables.filter(id=>selected.has(id)).length} vị trí</span></div>):<p>Phiếu chưa chọn chỗ ngồi. Chọn vị trí trên sơ đồ.</p>}</div>
   <div className="booking-location-legend"><span><i/>Bàn của phiếu này</span><span><i/>Bàn khác</span></div>
   <div className="booking-location-floor"><div className="mini-floor-map restaurant-plan" aria-label="Sơ đồ vị trí các bàn đã đặt">
    {mapZones(booking.tables).map(z=><section key={z.id} className={'mini-zone mini-zone-'+z.id+(customZone(z.id)?' mini-zone-custom':'')+(z.retired?' retired-zone':'')}><h3>{z.title}{z.retired&&' · Vị trí cũ'}</h3><div className="mini-zone-tables">{z.tables.map(id=><span key={id} className={'booking-location-table'+(selected.has(id)?' selected':'')} aria-label={z.title+' · ô '+(z.tables.indexOf(id)+1)+(selected.has(id)?' · '+portableTableText(booking):'')}><Armchair size={12}/><span className="position-number">{tableNumber(id)}</span>{selected.has(id)&&booking.tableLabel&&<b>{booking.tableLabel}</b>}</span>)}</div></section>)}
    <RestaurantFacilities/><MapStage/><MapKitchen/>
   </div></div>
   <p className="booking-location-help">Bàn tô xanh thuộc phiếu đang mở. Sơ đồ hiển thị vị trí; dùng “Chọn bàn” để chỉnh sửa.</p>
  </div>
 </aside>;
}

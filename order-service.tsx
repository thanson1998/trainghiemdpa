import {isTakeaway,type Booking} from './model';
import './takeaway.css';
export function OrderServiceChoice({booking,onChange,disabled=false}:{booking:Booking;onChange:(type:'dine-in'|'takeaway')=>void;disabled?:boolean}){
 return <div className="order-service-choice"><div role="group" aria-label="Hình thức phục vụ"><button type="button" disabled={disabled} className={!isTakeaway(booking)?'selected':''} aria-pressed={!isTakeaway(booking)} onClick={()=>onChange('dine-in')}>Tại quán</button><button type="button" disabled={disabled} className={isTakeaway(booking)?'selected':''} aria-pressed={isTakeaway(booking)} onClick={()=>onChange('takeaway')}>Mang về</button></div>{isTakeaway(booking)&&<p>Đơn mang về · Không cần chọn bàn · Vẫn in hóa đơn và phiếu bếp.</p>}</div>;
}

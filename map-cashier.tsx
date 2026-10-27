import './map-cashier.css';
export function MapCashier({mini=false}:{mini?:boolean}){
 return <div className={mini?'mini-map-counter map-cashier':'cashier facility map-cashier'} role="note" aria-label="Quầy thanh toán – thu ngân">
  <span className="map-cashier-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h13l-2 11H3L5 4Z"/><path d="M7 8h7M7 11h5M9 15v5"/><path d="M22 11V3h7v8M24 6h3M24 9h3"/><path d="M18 14h10l2 7H3l2-4"/><path d="M21 17h1m3 0h1"/><rect x="2" y="21" width="28" height="8" rx="2"/><path d="M12 25h8"/></svg></span>
  <span className="map-cashier-label"><b>Quầy thanh toán</b>{!mini&&<small>Đón tiếp & thanh toán</small>}</span>
 </div>;
}

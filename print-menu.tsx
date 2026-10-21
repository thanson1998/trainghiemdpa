import {useEffect,useRef} from 'react';
import {Printer,X} from 'lucide-react';
import {money,zones,type Booking} from './model';

export function MenuPrintPreview({booking,onClose}:{booking:Booking;onClose:()=>void}){
 const dialog=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onClose()}
   if(event.key==='Tab'){
    const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button');
    if(!buttons?.length)return;
    if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons[buttons.length-1].focus()}
    else if(!event.shiftKey&&document.activeElement===buttons[buttons.length-1]){event.preventDefault();buttons[0].focus()}
   }
  };
  window.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=oldOverflow;window.removeEventListener('keydown',key);previous?.focus()};
 },[onClose]);
 const count=booking.tables.length;
 const dishes=booking.menu.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const date=new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(booking.date+'T12:00:00'));
 return <div className="menu-print-overlay" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="print-menu-title">
  <div className="menu-print-toolbar"><div><b>Xem trước menu</b><small>Khổ A4 · Có thể in hoặc lưu PDF</small></div><button type="button" className="secondary-btn" onClick={onClose}><X size={16}/>Đóng</button><button type="button" className="primary-btn" onClick={()=>window.print()}><Printer size={16}/>In / Lưu PDF</button></div>
  <article className="menu-print-sheet">
   <header className="menu-print-heading"><div className="menu-print-brand">DPA<span>TRẢI NGHIỆM · THÁI NGUYÊN</span></div><p>TRÂN TRỌNG ĐÓN TIẾP</p><h1 id="print-menu-title">THỰC ĐƠN ĐẶT TIỆC</h1><h2>{booking.name}</h2></header>
   <dl className="menu-print-facts"><div><dt>Ngày đặt tiệc</dt><dd>{date}</dd></div><div><dt>Thời gian</dt><dd>{booking.start} – {booking.end}</dd></div><div><dt>Số người</dt><dd>{booking.people*count} người<small>{booking.people} người / bàn</small></dd></div><div><dt>Số mâm</dt><dd>{booking.platters*count} mâm<small>{booking.platters} mâm / bàn</small></dd></div></dl>
   <section className="menu-print-location"><h3>VỊ TRÍ BÀN</h3>{zones.filter(z=>z.tables.some(id=>booking.tables.includes(id))).map(z=><div key={z.id}><strong>{z.id==='FRONT'?'Trước quầy thanh toán':z.title}</strong><span>{booking.tables.filter(id=>z.tables.includes(id)).map(id=>'Bàn '+id).join(' · ')}</span></div>)}</section>
   <section className="menu-print-dishes"><h3>THỰC ĐƠN</h3>{dishes.length?<ol>{dishes.map((dish,i)=><li key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{dish}</p></li>)}</ol>:<p className="menu-print-empty">Chưa cập nhật món ăn.</p>}</section>
   <section className="menu-print-price"><div><span>Giá mỗi bàn</span><b>{money(booking.price)}</b></div><div><span>Số bàn</span><b>{count} bàn</b></div><div className="menu-print-total"><span>TỔNG TIỀN</span><strong>{money(booking.price*count)}</strong></div></section>
   <footer className="menu-print-footer">Trải Nghiệm DPA · Chu đáo từ lúc đặt bàn.</footer>
  </article>
 </div>
}

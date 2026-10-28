import {billPaymentDetails} from './bill-payment-details';
import './bill-payment.css';
import {isTakeaway,orderLocation,orderUnits,bookingTotal,money,guestCount,zoneOf,type Booking} from './model';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {readMenu,readMenuSet,menuSetQuantity,itemQuantity,itemUnit,itemAmount,menuSum} from './menu';
export function CheckoutBill({booking:b}:{booking:Booking}){
 const set=readMenuSet(b.menu),items=readMenu(b.menu,orderUnits(b)).filter(i=>i.name.trim()),total=bookingTotal(b),deposit=b.deposit??0;
 return <article className="checkout-bill"><header><h2>TRẢI NGHIỆM DPA</h2><h3>BILL TẠM TÍNH</h3><p>{b.orderCode||b.id}</p></header><div className="checkout-bill-facts"><p><b>{orderLocation(b)}</b></p><p>{[...new Set(b.tables.map(t=>zoneOf(t)?.title||t))].join(' · ')}</p><p>Khách: <b>{b.name}</b> · {guestCount(b)} người</p>{b.phone&&<p>Điện thoại: {b.phone}</p>}<p>{b.date.split('-').reverse().join('/')} · {b.start}–{b.end}</p></div><table className="checkout-bill-table"><thead><tr><th>Tên món</th><th>SL / ĐVT</th><th>Đơn giá</th><th>Tổng</th></tr></thead><tbody>{set&&<tr className="checkout-bill-set"><td><b>{set.name}</b></td><td>{menuSetQuantity(b.menu,orderUnits(b))} set</td><td>{money(set.pricePerTable)}</td><td>{money(set.pricePerTable*menuSetQuantity(b.menu,orderUnits(b)))}</td></tr>}{items.map((i,n)=><tr key={n}><td>{i.name}</td><td><b>{itemQuantity(i)}</b> {itemUnit(i)}</td><td>{i.included?'—':i.price===null?'Chưa nhập':money(i.price)}</td><td>{i.included?<small>Trong set</small>:i.price===null?'Theo giá chốt':money(itemAmount(i))}</td></tr>)}</tbody></table>{!items.length&&<p className="checkout-bill-empty">Đơn chưa có món trong thực đơn. Kiểm tra trước khi thu tiền.</p>}{menuSum(b.menu,orderUnits(b))!==total&&<p className="checkout-bill-agreed">Tổng thanh toán theo giá đã lưu: {money(bookingTotal(b))}. Tổng món hiện tại: {money(menuSum(b.menu,orderUnits(b)))}.</p>}{b.note&&<div className="checkout-bill-note"><b>Ghi chú</b><p>{b.note}</p></div>}<div className="checkout-bill-settlement"><div className="checkout-bill-totals"><p><b>TỔNG TIỀN</b><strong>{money(total)}</strong></p><p><span>Đã cọc</span><b>{money(deposit)}</b></p><p><b>CÒN PHẢI THU</b><strong>{money(total-deposit)}</strong></p></div>{total-deposit>0&&!b.paidAt&&b.status!=='cancelled'&&<section className="checkout-bill-payment" aria-label="Thông tin chuyển khoản"><h3>QUÉT MÃ THANH TOÁN</h3><p><b>{billPaymentDetails.bank}</b></p><p>Người nhận: <b>{billPaymentDetails.name}</b></p><p>Tài khoản nhận: <b>{billPaymentDetails.account}</b></p><img src={billPaymentDetails.qrUrl} alt="Mã QR thanh toán MB - DOAN THI THANH VAN" width="220" height="220"/><p>Nhập số tiền: <b>{money(total-deposit)}</b></p><small>Kiểm tra tên người nhận và nhập đúng số tiền còn phải thu khi chuyển khoản.</small></section>}</div><footer>Bill tạm tính · Chưa xác nhận thanh toán</footer></article>;
}
export function CheckoutBillPrint({booking,onClose}:{booking:Booking;onClose:()=>void}){
 const box=useRef<HTMLDivElement>(null),paper=useRef<HTMLDivElement>(null);const [height,setHeight]=useState(250),[printError,setPrintError]=useState(''),[printing,setPrinting]=useState(false);
 useLayoutEffect(()=>{let alive=true;const measure=()=>{if(alive)setHeight(Math.ceil((paper.current?.scrollHeight??800)*25.4/96)+10);};measure();const observer=new ResizeObserver(measure);if(paper.current)observer.observe(paper.current);void document.fonts.ready.then(measure);return()=>{alive=false;observer.disconnect();};},[]);
 async function printBill(){
 setPrinting(true);setPrintError('');
 try{
  await document.fonts.ready;
  const images=Array.from(paper.current?.querySelectorAll('img')??[]);
  await Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise<void>((resolve,reject)=>{
   const timer=window.setTimeout(()=>{cleanup();reject(Error('QR chưa tải xong. Vui lòng thử in lại.'));},15000);
   const cleanup=()=>{clearTimeout(timer);img.removeEventListener('load',loaded);img.removeEventListener('error',failed);};
   const loaded=()=>{cleanup();resolve();};const failed=()=>{cleanup();reject(Error('Chưa tải được mã QR. Vui lòng tải lại phiếu trước khi in.'));};
   img.addEventListener('load',loaded,{once:true});img.addEventListener('error',failed,{once:true});
  })));
  if(images.some(img=>!img.naturalWidth))throw Error('Chưa tải được mã QR. Vui lòng tải lại phiếu trước khi in.');
  setHeight(Math.ceil((paper.current?.scrollHeight??800)*25.4/96)+10);
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  window.print();
 }catch(error){setPrintError(error instanceof Error?error.message:'Chưa chuẩn bị được phiếu in.');}finally{setPrinting(false);}
 }

 useEffect(()=>{const old=document.body.style.overflow,previous=document.activeElement as HTMLElement;document.body.style.overflow='hidden';box.current?.querySelector<HTMLButtonElement>('button')?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose();}if(e.key==='Tab'){const els=Array.from(box.current?.querySelectorAll<HTMLButtonElement>('button')??[]);if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0]?.focus();}}};window.addEventListener('keydown',key);return()=>{document.body.style.overflow=old;window.removeEventListener('keydown',key);previous?.focus();};},[onClose]);
 return createPortal(<div className="checkout-bill-overlay"><div className="checkout-bill-print-dialog" ref={box} role="dialog" aria-modal="true" aria-label="In bill tạm tính"><div className="checkout-bill-print-actions"><button className="primary-btn" disabled={printing} onClick={()=>void printBill()}>{printing?'Đang chuẩn bị mã QR…':'In bill 80mm'}</button><button className="secondary-btn" onClick={onClose}>Quay lại thanh toán</button></div>{printError&&<p className="form-error checkout-bill-print-error" role="alert">{printError}</p>}<style>{`@media print{@page{size:80mm ${height}mm;margin:0}}`}</style><div className="checkout-bill-paper" ref={paper}><CheckoutBill booking={booking}/></div></div></div>,document.body);
}


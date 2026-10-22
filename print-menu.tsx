import {apiRequest} from './sync';
import {kitchenDelta} from './kitchen-delta';
import {formatMoneyText,readMenu,menuSum,itemQuantity,itemAmount,readMenuSet,menuSetQuantity} from './menu';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Printer,X,Download,LoaderCircle} from 'lucide-react';
import html2canvas from 'html2canvas';
import {money,zones,guestCount,type Booking} from './model';

export function MenuPrintPreview({booking,onClose}:{booking:Booking;onClose:()=>void}){
 const [lastSent,setLastSent]=useState<(Booking&{confirmedAt?:string})|null>(null),[deltaMode,setDeltaMode]=useState(false),[printStatus,setPrintStatus]=useState(''),[confirming,setConfirming]=useState(false),[baselineReady,setBaselineReady]=useState(false);
 useEffect(()=>{let alive=true;setBaselineReady(false);if(!booking.version){setBaselineReady(true);return;}void apiRequest('/api/bookings/prints?id='+encodeURIComponent(booking.id)).then(async r=>{const j=await r.json() as {last:Booking|null;error:string};if(!r.ok)throw Error(j.error);if(alive){setLastSent(j.last);setBaselineReady(true);}}).catch(()=>{if(alive)setPrintStatus('Chưa tải được lần gửi bếp trước. Đóng và mở lại phiếu để thử lại.');});return()=>{alive=false;};},[booking.id,booking.version]);
 async function confirmSent(){setConfirming(true);setPrintStatus('');try{const r=await apiRequest('/api/bookings/prints',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({booking})}),j=await r.json() as {error:string};if(!r.ok)throw Error(j.error);setLastSent({...booking,confirmedAt:new Date().toISOString()});setDeltaMode(false);setPrintStatus('Đã ghi nhận gửi bếp. Lần in bổ sung tiếp theo sẽ so với phiếu này.');}catch(e){setPrintStatus(e instanceof Error?e.message:'Chưa xác nhận được.');}finally{setConfirming(false);}}
 const difference=lastSent?kitchenDelta(lastSent,booking):null;
 const dialog=useRef<HTMLDivElement>(null);
 const sheet=useRef<HTMLElement>(null);
 const [paperHeight,setPaperHeight]=useState(160);
 const [savingImage,setSavingImage]=useState(false),[imageNotice,setImageNotice]=useState('');
 async function saveImage(){
  if(!sheet.current||savingImage)return;
  setSavingImage(true);setImageNotice('');
  try{
   await document.fonts.ready;
   const height=Math.max(1,sheet.current.scrollHeight);
   const scale=Math.min(3,Math.sqrt(12000000/(303*height)),16000/height);
   const canvas=await html2canvas(sheet.current,{scale,backgroundColor:'#fff',logging:false,scrollX:0,scrollY:0,onclone:(doc,clonedSheet)=>{
    doc.body.appendChild(clonedSheet);
    Object.assign(clonedSheet.style,{position:'absolute',left:'0',top:'0',width:'80mm',maxWidth:'none',height:'auto',margin:'0',boxShadow:'none'});
    doc.body.style.overflow='visible';doc.documentElement.style.overflow='visible';
   }});
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('Không tạo được ảnh.')),'image/png'));
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   const tables=booking.tables.join('-').replace(/[^a-zA-Z0-9-]/g,'').slice(0,100)||'chua-chon';
   link.href=url;link.download=(deltaMode?'DPA-bo-sung-':'DPA-menu-')+booking.date+'-ban-'+tables+'.png';link.style.display='none';
   document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
   setImageNotice('Đã tải ảnh PNG của toàn bộ phiếu in.');
  }catch{setImageNotice('Chưa lưu được ảnh. Vui lòng thử lại.');}finally{setSavingImage(false);}
 }

 useLayoutEffect(()=>{if(sheet.current)setPaperHeight(Math.max(40,Math.ceil(sheet.current.scrollHeight*25.4/96)+4));},[booking,deltaMode,lastSent]);
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
 const dishes=readMenu(booking.menu,count).filter(item=>item.name.trim());
 const date=new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(booking.date+'T12:00:00'));
 return <div className="menu-print-overlay" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="print-menu-title">
  <div className="menu-print-toolbar"><div><b>Xem trước menu</b><small>Giấy cuộn 80 mm · Chọn khổ 80 mm và tỷ lệ 100% khi in</small></div><button type="button" className="secondary-btn" onClick={onClose}><X size={16}/>Đóng</button><button type="button" className="secondary-btn" disabled={savingImage} onClick={()=>void saveImage()}>{savingImage?<LoaderCircle size={16} className="spin"/>:<Download size={16}/>} {savingImage?'Đang tạo ảnh…':'Lưu ảnh phiếu in'}</button><button type="button" className="primary-btn" onClick={()=>window.print()}><Printer size={16}/>In / Lưu PDF</button></div>
  <div className="kitchen-delta-controls"><button type="button" className="secondary-btn" aria-pressed={!deltaMode} onClick={()=>setDeltaMode(false)}>Phiếu đầy đủ</button><button type="button" className="secondary-btn" disabled={!lastSent||!difference?.changed||!baselineReady} aria-pressed={deltaMode} onClick={()=>setDeltaMode(true)}>In món bổ sung / thay đổi</button><button type="button" className="primary-btn" disabled={confirming||!booking.version||!baselineReady} onClick={()=>void confirmSent()}>{confirming?'Đang ghi nhận…':'Đã gửi bếp — ghi nhận'}</button></div>
  <p className="kitchen-delta-notice">{lastSent?'Đã có phiếu gửi bếp trước. Mục bổ sung chỉ liệt kê thay đổi.':'Chưa có phiếu gửi bếp được xác nhận.'} Sau khi chuyển phiếu cho bếp, bấm “Đã gửi bếp — ghi nhận”.{!booking.version&&' Hãy lưu đơn để dùng chức năng này.'}</p>
  {printStatus&&<p className="kitchen-delta-notice" role="status">{printStatus}</p>}
  {imageNotice&&<p className="menu-print-export-status" role="status">{imageNotice}</p>}
  <style media="print">{`@page { size: 80mm ${paperHeight}mm; margin: 0; }`}</style>
  <article className="menu-print-sheet" ref={sheet}>
   <header className="menu-print-heading"><div className="menu-print-brand">DPA<span>TRẢI NGHIỆM · THÁI NGUYÊN</span></div><p>TRÂN TRỌNG ĐÓN TIẾP</p><h1 id="print-menu-title">{deltaMode?'PHIẾU BỔ SUNG / THAY ĐỔI':'THỰC ĐƠN ĐẶT TIỆC'}</h1><h2>{booking.name}</h2></header>
   <dl className="menu-print-facts"><div><dt>Ngày đặt tiệc</dt><dd>{date}</dd></div><div><dt>Thời gian</dt><dd>{booking.start} – {booking.end}</dd></div><div><dt>Số người</dt><dd>{guestCount(booking)} người{booking.totalPeople==null&&<small>{booking.people} người / bàn</small>}</dd></div></dl>
   <section className="menu-print-location"><h3>VỊ TRÍ BÀN</h3>{zones.filter(z=>z.tables.some(id=>booking.tables.includes(id))).map(z=><div key={z.id}><strong>{z.id==='FRONT'?'Trước quầy thanh toán':z.title}</strong><span>{booking.tables.filter(id=>z.tables.includes(id)).map(id=>'Bàn '+id).join(' · ')}</span></div>)}</section>
   {deltaMode?<section className="menu-print-dishes"><h3>THAY ĐỔI SO VỚI PHIẾU ĐÃ GỬI</h3><p>In lúc {new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false})}</p>{difference?.added.length? <><h4 className="kitchen-change-label">THÊM / LÀM THÊM</h4>{difference.added.map((item,i)=><p className="kitchen-delta-change" key={'add'+i}><b>+{item.quantity} {item.unit}</b> · {item.name}</p>)}</>:<p>Không thêm số lượng món.</p>}{!!difference?.removed.length&&<><h4 className="kitchen-change-label">GIẢM / HỦY MÓN</h4>{difference.removed.map((item,i)=><p className="kitchen-delta-change" key={'remove'+i}><b>Giảm {item.quantity} {item.unit}</b> · {item.name}</p>)}</>}{difference?.notes.map((note,i)=><p key={i}>{note}</p>)}</section>:<section className="menu-print-dishes"><h3>THỰC ĐƠN</h3>{readMenuSet(booking.menu)&&<p className="menu-print-set-name">{formatMoneyText(readMenuSet(booking.menu)!.name)} · {menuSetQuantity(booking.menu,count)} set</p>}{dishes.length?<ol>{dishes.map((dish,i)=><li key={i}><span className="dish-print-count">{itemQuantity(dish)}</span><p>{dish.name}</p>{!dish.included&&<b className="dish-print-price">{dish.price===null?'—':money(itemAmount(dish))}</b>}</li>)}</ol>:<p className="menu-print-empty">Chưa cập nhật món ăn.</p>}{dishes.some(item=>item.price!==null)&&<div className="menu-print-subtotal"><span>Tổng giá món{dishes.some(item=>!item.included&&item.price===null)&&<small>Một số món chưa nhập giá</small>}</span><b>{money(menuSum(booking.menu,count))}</b></div>}</section>}
   {booking.note.trim()&&<section className="menu-print-notes"><h3>GHI CHÚ PHỤC VỤ</h3><p>{booking.note}</p></section>}{!deltaMode&&<section className="menu-print-price"><div><span>Giá mỗi bàn</span><b>{money(booking.price)}</b></div><div><span>Số bàn</span><b>{count} bàn</b></div><div className="menu-print-total"><span>TỔNG TIỀN</span><strong>{money(booking.price*count)}</strong></div><div><span>Đã cọc</span><b>{money(booking.deposit??0)}</b></div><div className="menu-print-balance"><span>CÒN LẠI</span><strong>{money(booking.price*count-(booking.deposit??0))}</strong></div></section>}
   <footer className="menu-print-footer">Trải Nghiệm DPA · Chu đáo từ lúc đặt bàn.</footer>
  </article>
 </div>
}

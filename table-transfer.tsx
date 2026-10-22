import {useState,useEffect,useRef} from 'react';
import {ArrowRightLeft,X,RefreshCw,Check,LoaderCircle} from 'lucide-react';
import {zones,type Booking} from './model';
import {apiRequest} from './sync';

export function TableTransfer({booking,onClose,onMoved}:{booking:Booking;onClose:()=>void;onMoved:(tables:string[],version:number)=>void}){
 const [source,setSource]=useState<Booking|null>(null),[rows,setRows]=useState<Booking[]>([]),[selected,setSelected]=useState<string[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[zone,setZone]=useState('all');
 const dialog=useRef<HTMLDivElement>(null),busy=useRef(false),requestId=useRef(0),mounted=useRef(true);
 busy.current=saving;
 async function refresh(){const seq=++requestId.current;setLoading(true);setError('');try{
  const r=await apiRequest('/api/bookings?date='+booking.date,{cache:'no-store'});const j=await r.json() as {bookings?:Booking[];error?:string};
  if(!mounted.current||seq!==requestId.current)return;
  if(!r.ok)throw new Error(j.error||'Không tải được lịch bàn.');
  const current=j.bookings?.find(b=>b.id===booking.id);
  if(!current||current.version!==booking.version)throw new Error('Đơn vừa thay đổi. Đóng hộp này, tải lại dữ liệu và mở lại chi tiết trước khi chuyển bàn.');
  if(current.status==='cancelled')throw new Error('Đơn đã hủy không thể chuyển bàn.');
  setSource(current);setRows(j.bookings??[]);setSelected([...current.tables]);
 }catch(e){if(mounted.current&&seq===requestId.current){setSource(null);setError(e instanceof Error?e.message:'Không tải được lịch bàn.');}}finally{if(mounted.current&&seq===requestId.current)setLoading(false);}}
 useEffect(()=>{mounted.current=true;void refresh();return()=>{mounted.current=false;requestId.current++;};},[]);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.querySelector<HTMLButtonElement>('[data-close-transfer]')?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!busy.current)onClose();}if(e.key==='Tab'){const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled)')??[]);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
  window.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',key);previous?.focus();};
 },[onClose]);
 const occupied=new Set(source?rows.filter(b=>b.id!==source.id&&b.status!=='cancelled'&&b.start<source.end&&b.end>source.start).flatMap(b=>b.tables):[]);
 const unchanged=!!source&&selected.length===source.tables.length&&selected.every(id=>source.tables.includes(id));
 const canMove=!!source&&!loading&&!saving&&selected.length===source.tables.length&&!unchanged&&!selected.some(id=>occupied.has(id));
 async function move(){if(!source||!canMove)return;setSaving(true);setError('');try{
  const r=await apiRequest('/api/bookings/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:source.id,version:source.version,tables:selected})});
  const j=await r.json() as {version:number;error?:string};if(!r.ok)throw new Error(j.error||'Chưa chuyển được bàn.');onMoved([...selected],j.version);
 }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Chưa chuyển được bàn.');}finally{if(mounted.current)setSaving(false);}}
 return <div className="table-transfer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)onClose();}}><div className="table-transfer-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="transfer-title" aria-describedby="transfer-description" aria-busy={loading||saving}>
  <header><div><ArrowRightLeft size={23}/><h2 id="transfer-title">Chuyển bàn</h2></div><button type="button" data-close-transfer className="icon-btn" aria-label="Đóng chuyển bàn" disabled={saving} onClick={onClose}><X size={22}/></button></header>
  <div className="table-transfer-body"><p id="transfer-description">Chuyển vị trí của đơn đã lưu, giữ nguyên số bàn, thực đơn, tiền và thông tin khách. Các chỉnh sửa khác trong cửa sổ chi tiết vẫn cần bấm Lưu đặt bàn.</p>
   <div className="table-transfer-source"><b>{source?.name??booking.name}</b><span>{booking.date.split('-').reverse().join('/')} · {source?.start??booking.start}–{source?.end??booking.end}</span>{source&&<span>Đang ở bàn: <strong>{source.tables.join(', ')}</strong> · {source.tables.length} bàn</span>}</div>
   <div className="table-transfer-tools"><label>Khu vực<select aria-label="Khu vực chuyển bàn" value={zone} disabled={loading||saving} onChange={e=>setZone(e.target.value)}><option value="all">Tất cả khu vực</option>{zones.map(z=><option key={z.id} value={z.id}>{z.title}</option>)}</select></label><button type="button" className="text-btn" disabled={loading||saving} onClick={()=>void refresh()}><RefreshCw size={15} className={loading?'spin':''}/>Tải lại bàn trống</button></div>
   {error&&<div className="form-error" role="alert">{error}</div>}
   {loading?<p role="status">Đang kiểm tra lịch bàn…</p>:source&&<><p className="table-transfer-help">Bỏ chọn bàn cũ rồi chọn bàn mới. Chọn đủ <b>{source.tables.length} bàn</b>; bàn có lịch trùng giờ sẽ bị khóa.</p><div className="table-picker transfer-table-picker">{zones.filter(z=>zone==='all'||z.id===zone).map(z=><div key={z.id}><span>{z.title}</span><div>{z.tables.map(id=>{const picked=selected.includes(id),taken=occupied.has(id);return <button type="button" key={id} disabled={saving||(taken&&!picked)} className={(picked?'picked ':'')+(taken?'busy':'')} aria-pressed={picked} aria-label={'Chuyển đến bàn '+id+(taken?' · đã có lịch':'')} title={taken?'Đã có lịch trùng giờ':source.tables.includes(id)?'Bàn hiện tại':id} onClick={()=>setSelected(picked?selected.filter(x=>x!==id):[...selected,id])}>{picked&&<Check size={13}/>} {id}{taken&&<i/>}</button>;})}</div></div>)}</div></>}
  </div><footer><div><small>Bàn sau khi chuyển</small><b>{selected.join(', ')||'Chưa chọn bàn'}</b>{source&&<span>Đã chọn {selected.length}/{source.tables.length} bàn</span>}</div><button type="button" className="secondary-btn" disabled={saving} onClick={onClose}>Giữ nguyên</button><button type="button" className="primary-btn" disabled={!canMove} onClick={()=>void move()}>{saving?<LoaderCircle size={17} className="spin"/>:<ArrowRightLeft size={17}/>} {saving?'Đang chuyển…':'Xác nhận chuyển bàn'}</button></footer>
 </div></div>;
}

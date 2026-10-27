import {useState} from 'react';
import type {LayoutState} from './table-layout-sync';
import './zone-manager.css';
type Draft={id?:string;title:string;count:number;type:string};
export function ZoneManager({layout,onSave,onReload}:{layout:LayoutState|null;onSave:(rows:Draft[],version:number)=>Promise<LayoutState>;onReload:()=>Promise<void>}){
 const [editing,setEditing]=useState(false),[rows,setRows]=useState<Draft[]>([]),[version,setVersion]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 function open(){if(!layout)return;setRows(layout.zones.map(z=>({id:z.id,title:z.title,count:z.count,type:z.type})));setVersion(layout.version);setError('');setNotice('');setEditing(true);}
 const valid=rows.length>0&&rows.every(z=>z.title.trim()&&Number.isInteger(z.count)&&z.count>=1&&z.count<=100);
 async function save(){if(busy||!valid)return;setBusy(true);setError('');try{await onSave(rows,version);setEditing(false);setNotice('Đã áp dụng khu vực và số bàn vào sơ đồ, POS và các phần chọn bàn.');}catch(e){setError(e instanceof Error?e.message:'Chưa lưu được khu vực.');}finally{setBusy(false);}}
 const patch=(i:number,data:Partial<Draft>)=>setRows(previous=>previous.map((z,n)=>n===i?{...z,...data}:z));
 return <section className="zone-manager" aria-label="Quản lý khu vực và bàn">
  <div className="zone-manager-bar"><b>Khu vực & bàn</b><span>{layout?layout.zones.length+' khu vực · '+layout.zones.reduce((n,z)=>n+z.count,0)+' bàn':'Đang tải cấu hình…'}</span>{!editing&&<button type="button" className="secondary-btn" disabled={!layout} onClick={open}>Quản lý khu vực / Thêm khu</button>}</div>
  {notice&&<p role="status">{notice}</p>}
  {editing&&<form onSubmit={e=>{e.preventDefault();void save();}}><p>Đổi tên, sửa số bàn hoặc thêm khu mới rồi bấm Lưu & áp dụng. Mã bàn hiện có được giữ nguyên; không giảm bỏ bàn đã có đơn hoặc lịch sử.</p><fieldset disabled={busy}>
   <div className="zone-editor-list">{rows.map((z,i)=><div className="zone-editor-row" key={z.id||'new-'+i}><label>Tên khu vực<input aria-label={'Tên khu vực '+(i+1)} required maxLength={80} value={z.title} onChange={e=>patch(i,{title:e.target.value})}/></label><label>Số bàn<input aria-label={'Số bàn khu vực '+(i+1)} required type="number" min={1} max={100} step={1} value={Number.isNaN(z.count)?'':z.count} onChange={e=>patch(i,{count:e.target.valueAsNumber})}/></label><label>Loại khu<select aria-label={'Loại khu vực '+(i+1)} value={z.type} onChange={e=>patch(i,{type:e.target.value})}><option value="outdoor">Ngoài trời</option><option value="patio">Sân vườn</option><option value="inside">Trong nhà</option></select></label><small>{z.id?'Mã khu: '+z.id:'Khu mới'}{!z.id&&<button type="button" className="text-btn" onClick={()=>setRows(previous=>previous.filter((_,n)=>n!==i))}>Bỏ khu mới</button>}</small></div>)}</div>
   <div className="zone-editor-actions"><button type="button" className="secondary-btn" disabled={rows.length>=50} onClick={()=>setRows(previous=>[...previous,{title:'',count:4,type:'patio'}])}>+ Thêm khu vực</button><button type="submit" className="primary-btn" disabled={!valid}>{busy?'Đang lưu…':'Lưu & áp dụng'}</button><button type="button" className="secondary-btn" onClick={()=>setEditing(false)}>Đóng</button><button type="button" className="text-btn" onClick={async()=>{await onReload();setEditing(false);}}>Tải lại cấu hình</button></div>
  </fieldset>{error&&<p className="form-error" role="alert">{error}</p>}</form>}
 </section>;
}

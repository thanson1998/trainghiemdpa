import {useState} from 'react';
import {Plus,Trash2} from 'lucide-react';
import {money} from './model';
import {readMenu,writeMenu,itemQuantity,itemUnit,itemAmount,menuSum,type MenuItem} from './menu';
import {type Catalog} from './catalog-model';
const newItem=():MenuItem=>({name:'',price:null,quantity:1,unit:'đĩa'});
export function MenuEditor({value,onChange,onApplyTotal,catalog,allowTemplates=true}:{value:string;onChange:(value:string)=>void;onApplyTotal?:(total:number)=>void;catalog?:Catalog;allowTemplates?:boolean}){
 const [selection,setSelection]=useState(''),[template,setTemplate]=useState(''),[notice,setNotice]=useState('');
 const parsed=readMenu(value),items=parsed.length?parsed:[newItem()];
 const named=items.filter(item=>item.name.trim());
 const priced=named.filter(item=>item.price!==null);
 const total=menuSum(value);
 const complete=named.length>0&&named.every(item=>item.price!==null&&Number.isInteger(item.price)&&item.price>=0&&item.price<=100000000&&itemQuantity(item)>0&&itemQuantity(item)<=1000);
 const update=(index:number,patch:Partial<MenuItem>)=>onChange(writeMenu(items.map((item,i)=>i===index?{...item,...patch}:item)));
 const append=(added:MenuItem[])=>{const kept=items.filter(item=>item.name.trim()||item.price!==null);if(kept.length+added.length>80){setNotice('Mỗi thực đơn tối đa 80 món.');return;}onChange(writeMenu([...kept,...added.map(item=>({...item}))]));setNotice('Đã thêm vào thực đơn. Bạn có thể sửa giá và số lượng riêng cho đặt bàn này.');};
 return <section className="dish-editor" aria-label="Món ăn và giá tiền">
  <div className="dish-editor-heading"><span>Món ăn / thực đơn</span><small>Số lượng và thành tiền tính cho mỗi bàn</small></div>
  {catalog&&<div className="menu-library-picker"><label>Chọn món từ thư viện<select aria-label="Chọn món từ thư viện" value={selection} onChange={e=>setSelection(e.target.value)}><option value="">{catalog.dishes.length?'Chọn món đã lưu…':'Chưa có món mẫu — tự thêm ở Thư viện thực đơn'}</option>{catalog.dishes.map(dish=><option key={dish.id} value={dish.id}>{dish.name} · {dish.unit}{dish.price!==null?' · '+money(dish.price):''}</option>)}</select></label><button type="button" className="secondary-btn" disabled={!selection} onClick={()=>{const dish=catalog.dishes.find(x=>x.id===selection);if(dish)append([{name:dish.name,unit:dish.unit,price:dish.price,quantity:1}]);}}>Thêm món đã chọn</button>
   {allowTemplates&&<><label>Chọn thực đơn mẫu<select aria-label="Chọn thực đơn mẫu" value={template} onChange={e=>setTemplate(e.target.value)}><option value="">{catalog.templates.length?'Chọn thực đơn đã lưu…':'Chưa có thực đơn mẫu'}</option>{catalog.templates.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label><button type="button" className="secondary-btn" disabled={!template} onClick={()=>{const t=catalog.templates.find(x=>x.id===template);if(t)append(readMenu(t.menu).filter(x=>x.name.trim()));}}>Thêm thực đơn mẫu</button></>}<small>Giá mẫu chỉ dùng để điền nhanh. Sửa giá tại đây không đổi thư viện.</small>
  </div>}
  {notice&&<p className="menu-notice" role="status">{notice}</p>}
  {items.map((item,i)=><div className="dish-card" key={i}>
   <div className="dish-editor-row"><input aria-label={`Tên món ${i+1}`} maxLength={200} value={item.name} placeholder="Tên món ăn" onChange={e=>update(i,{name:e.target.value})}/><button type="button" className="icon-btn dish-remove" aria-label={`Xóa món ${i+1}`} onClick={()=>onChange(writeMenu(items.filter((_,index)=>index!==i)))}><Trash2 size={16}/></button></div>
   <div className="dish-detail-grid"><label>Số lượng<input aria-label={`Số lượng món ${i+1}`} type="number" min="0.01" max="1000" step="0.01" value={itemQuantity(item)} onChange={e=>update(i,{quantity:Number(e.target.value)})}/></label><label>Đơn vị<input aria-label={`Đơn vị món ${i+1}`} maxLength={30} value={item.unit??'phần'} placeholder="đĩa, con, kg…" onChange={e=>update(i,{unit:e.target.value})}/></label><label>Đơn giá (VNĐ)<input aria-label={`Giá món ${i+1} (VNĐ)`} type="number" min="0" max="100000000" step="1" value={item.price??''} placeholder="Chưa nhập" onChange={e=>update(i,{price:e.target.value===''?null:Number(e.target.value)})}/></label></div>
   <div className="dish-line-total"><span>{itemQuantity(item)} {itemUnit(item)} / bàn</span><b>Thành tiền: {item.price===null?'Chưa nhập giá':money(itemAmount(item))}</b></div>
  </div>)}
  <button type="button" className="text-btn dish-add" disabled={items.length>=80} onClick={()=>onChange(writeMenu([...items,newItem()]))}><Plus size={15}/>Thêm món</button>
  {priced.length>0&&<div className="dish-editor-total"><div><span>Tổng giá đã nhập / bàn</span><strong>{money(total)}</strong></div>{onApplyTotal&&<button type="button" className="secondary-btn" disabled={!complete||total>100000000} onClick={()=>onApplyTotal(total)}>Dùng tổng món làm giá bàn</button>}{!complete&&<small>Nhập đủ giá và số lượng các món để áp dụng tổng vào giá bàn.</small>}</div>}
 </section>
}

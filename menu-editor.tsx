import {Plus,Trash2} from 'lucide-react';
import {money} from './model';
import {readMenu,writeMenu,type MenuItem} from './menu';

export function MenuEditor({value,onChange,onApplyTotal}:{value:string;onChange:(value:string)=>void;onApplyTotal:(total:number)=>void}){
 const parsed=readMenu(value),items=parsed.length?parsed:[{name:'',price:null}];
 const named=items.filter(item=>item.name.trim());
 const priced=named.filter(item=>item.price!==null);
 const total=priced.reduce((sum,item)=>sum+(item.price??0),0);
 const complete=named.length>0&&named.every(item=>item.price!==null&&Number.isInteger(item.price)&&item.price>=0&&item.price<=100000000);
 const update=(index:number,patch:Partial<MenuItem>)=>onChange(writeMenu(items.map((item,i)=>i===index?{...item,...patch}:item)));
 return <section className="dish-editor" aria-label="Món ăn và giá tiền">
  <div className="dish-editor-heading"><span>Món ăn / thực đơn</span><small>Giá món tính cho mỗi bàn</small></div>
  <div className="dish-editor-columns" aria-hidden="true"><span>Tên món ăn</span><span>Giá tiền (VNĐ)</span><span/></div>
  {items.map((item,i)=><div className="dish-editor-row" key={i}><input aria-label={`Tên món ${i+1}`} maxLength={200} value={item.name} placeholder="Ví dụ: Gà ta hấp lá chanh" onChange={e=>update(i,{name:e.target.value})}/><input aria-label={`Giá món ${i+1} (VNĐ)`} type="number" min="0" max="100000000" step="1" value={item.price??''} placeholder="Chưa nhập" onChange={e=>update(i,{price:e.target.value===''?null:Number(e.target.value)})}/><button type="button" className="icon-btn dish-remove" aria-label={`Xóa món ${i+1}`} onClick={()=>onChange(writeMenu(items.filter((_,index)=>index!==i)))}><Trash2 size={16}/></button></div>)}
  <button type="button" className="text-btn dish-add" disabled={items.length>=80} onClick={()=>onChange(writeMenu([...items,{name:'',price:null}]))}><Plus size={15}/>Thêm món</button>
  {priced.length>0&&<div className="dish-editor-total"><div><span>Tổng giá đã nhập / bàn</span><strong>{money(total)}</strong></div><button type="button" className="secondary-btn" disabled={!complete||total>100000000} onClick={()=>onApplyTotal(total)}>Dùng tổng món làm giá bàn</button>{!complete&&<small>Nhập đủ giá các món để áp dụng tổng vào giá bàn.</small>}</div>}
 </section>
}

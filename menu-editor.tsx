import {templateFlags,sortTemplates} from './template-flags';
import {money} from './model';
import {MenuActions} from './menu-actions';
import {DishSearch} from './dish-search';
import {useState} from 'react';
import {Plus,Trash2} from 'lucide-react';
import {PriceInput} from './price-input';
import {templateAddedItems,prepareTemplateMenu,formatMoneyText,readMenu,writeMenu,itemQuantity,mergeMenuItems,menuSum,readMenuSet,menuSetQuantity,setMenuQuantity,type MenuItem} from './menu';
import {type Catalog} from './catalog-model';
const newItem=(inSet=false):MenuItem=>({name:'',price:null,quantity:1,unit:'đĩa',...(inSet?{included:true}:{})});
export function MenuEditor({value,onChange,onApplyTotal,catalog,allowTemplates=true,tableCount=1,onApplySet,editingTemplate=false}:{value:string;onChange:(value:string)=>void;onApplyTotal?:(total:number)=>void;catalog?:Catalog;allowTemplates?:boolean;editingTemplate?:boolean;tableCount?:number;onApplySet?:(people:number)=>void}){
 const [template,setTemplate]=useState(''),[notice,setNotice]=useState(''),[templateQuantity,setTemplateQuantity]=useState(1);
 const [showUnits,setShowUnits]=useState(false);
 const sourceSet=readMenuSet(value);
 const editingSetTemplate=editingTemplate&&!!sourceSet;
 const set=sourceSet?{...sourceSet,quantity:menuSetQuantity(value,tableCount)}:undefined;
 const setCount=menuSetQuantity(value,tableCount);
 const selectedSet=catalog?readMenuSet(catalog.templates.find(t=>t.id===template)?.menu??''):undefined;
 const changeSetCount=(quantity:number)=>{if(!set||!Number.isInteger(quantity)||quantity<1||quantity>1000)return;try{onChange(setMenuQuantity(value,quantity,tableCount));if(set.people)onApplySet?.(set.people*quantity);setNotice('');}catch(error){setNotice(error instanceof Error?error.message:'Không thể đổi số lượng set.');}};
 const parsed=readMenu(value,tableCount),items=parsed.length?parsed:[newItem(editingSetTemplate)];
 const named=items.filter(item=>item.name.trim());
 const priced=named.filter(item=>item.price!==null);
 const total=menuSum(value,tableCount);
 const complete=named.length>0&&named.every(item=>(item.included||(item.price!==null&&Number.isInteger(item.price)&&item.price>=0&&item.price<=100000000))&&itemQuantity(item)>0&&itemQuantity(item)<=1000);
 const update=(index:number,patch:Partial<MenuItem>)=>onChange(writeMenu(items.map((item,i)=>i===index?{...item,...patch}:item),set));
 const commitMerged=(rows:MenuItem[],message:string)=>{try{const merged=mergeMenuItems(rows);if(merged.length>80){setNotice('Mỗi thực đơn tối đa 80 món.');return;}onChange(writeMenu(merged,set));setNotice(merged.length<rows.length?'Đã cộng dồn số lượng món trùng. Giữ nguyên đơn giá và đơn vị đang có trong menu.':message);}catch(error){setNotice(error instanceof Error?error.message:'Không thể cộng dồn món.');}};
 const append=(added:MenuItem[])=>commitMerged([...items.filter(item=>item.name.trim()||item.price!==null),...templateAddedItems(added,editingSetTemplate)],'Đã thêm vào thực đơn. Bạn có thể sửa giá và số lượng riêng cho đặt bàn này.');
 const mergeTyped=()=>{if(items.some((item,i)=>items.slice(0,i).some(other=>other.name.trim()&&other.name.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi-VN')===item.name.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi-VN'))))commitMerged(items,'');};

 return <section className="dish-editor" aria-label="Món ăn và giá tiền">
  <div className="dish-editor-heading"><span>Món ăn / thực đơn</span><small>{set?'Số lượng món tự nhân theo số set' :'Số lượng và thành tiền tính cho toàn bộ thực đơn'}</small></div>
  {catalog&&<div className="menu-library-picker"><DishSearch dishes={catalog.dishes} onAdd={dish=>append([{name:dish.name,unit:dish.unit,price:dish.price,quantity:1}])}/>
   {allowTemplates&&<><label>Chọn thực đơn mẫu<select aria-label="Chọn thực đơn mẫu" value={template} onChange={e=>{setTemplate(e.target.value);setTemplateQuantity(1)}}><option value="">{catalog.templates.length?'Chọn thực đơn đã lưu…':'Chưa có thực đơn mẫu'}</option>{sortTemplates(catalog.templates).map(t=><option value={t.id} key={t.id} disabled={templateFlags(t.menu).soldOut}>{formatMoneyText(t.name)}{templateFlags(t.menu).soldOut?' · Tạm hết':''}</option>)}</select></label>{selectedSet&&<label className="menu-set-picker-quantity">Số lượng set<input aria-label="Số lượng set muốn chọn" type="number" min="1" max="1000" step="1" value={templateQuantity} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=1000)setTemplateQuantity(n)}}/></label>}<button type="button" className="secondary-btn" disabled={!template} onClick={()=>{const t=catalog.templates.find(x=>x.id===template);if(t){if(templateFlags(t.menu).soldOut){setNotice('Set này đang tạm hết.');return;}const templateMenu=prepareTemplateMenu(t.menu,t.name),bundle=readMenuSet(templateMenu);if(bundle){try{onChange(setMenuQuantity(templateMenu,templateQuantity));if(bundle.people)onApplySet?.(bundle.people*templateQuantity);}catch(error){setNotice(error instanceof Error?error.message:'Không thể áp dụng set.');return;}setNotice('Đã áp dụng set. Số lượng món và tổng tiền tính theo số set đã chọn.');}else append(readMenu(t.menu).filter(x=>x.name.trim()));}}}>{readMenuSet(catalog.templates.find(t=>t.id===template)?.menu??'')?'Áp dụng set (thay thực đơn hiện tại)':'Thêm thực đơn mẫu'}</button></>}<small>{editingTemplate?'Chỉnh sửa món và giá, sau đó bấm Lưu thực đơn mẫu để cập nhật thư viện.':'Giá mẫu chỉ dùng để điền nhanh. Sửa giá tại đây không đổi thư viện.'}</small>
  </div>}
  {notice&&<p className="menu-notice" role="status">{notice}</p>}
  {set&&<div className="menu-set-summary"><b>{formatMoneyText(set.name)}</b><span>{money(set.pricePerTable)} / set{set.people?` · ${set.people} người / set`:""}</span><div className="form-row">{allowTemplates&&<label>Số lượng set<input aria-label="Số lượng set" type="number" min="1" max="1000" step="1" value={setCount} onChange={e=>changeSetCount(Number(e.target.value))}/></label>}<label>Giá / set (VNĐ)<PriceInput label="Giá trọn set (VNĐ)" value={set.pricePerTable} onChange={price=>onChange(writeMenu(items,{...set,pricePerTable:price??0}))}/></label><label>Số người / set<input aria-label="Số người trong set" type="number" min="1" max="1000" placeholder="Không quy định" value={set.people??''} onChange={e=>onChange(writeMenu(items,{...set,people:e.target.value?Number(e.target.value):undefined}))}/></label></div><strong>Tổng {setCount} set: {money(set.pricePerTable*setCount)}</strong><small>Món trong set không có đơn giá riêng. Số lượng bên dưới là tổng cho {setCount} set, không nhân thêm số bàn.</small></div>}
  <MenuActions value={value} onChange={onChange} tableCount={tableCount}/>
  <button type="button" className="text-btn unit-toggle" aria-expanded={showUnits} onClick={()=>setShowUnits(!showUnits)}>{showUnits?'Thu gọn đơn vị':'Hiện ô sửa đơn vị'}</button>
  <div className={'dish-items '+(showUnits?'show-units':'')}><div className="dish-compact-head" aria-hidden="true"><span>Tên món</span><span>Số lượng</span><span>Đơn vị</span><span>Đơn giá (VNĐ)</span><span/></div>
  {items.map((item,i)=><div className="dish-compact-row" key={i}>
   <input aria-label={`Tên món ${i+1}`} maxLength={200} value={item.name} placeholder="Tên món ăn" onBlur={mergeTyped} onChange={e=>update(i,{name:e.target.value})}/>
   <input aria-label={`Số lượng món ${i+1}`} type="number" min="0.01" max="1000" step="0.01" value={itemQuantity(item)} onChange={e=>update(i,{quantity:Number(e.target.value)})}/>
   <input aria-label={`Đơn vị món ${i+1}`} maxLength={30} value={item.unit??'đĩa'} placeholder="đĩa" onChange={e=>update(i,{unit:e.target.value})}/>
   {item.included?<span className="set-included-price">Trong giá set</span>:<PriceInput label={`Giá món ${i+1} (VNĐ)`} value={item.price} placeholder="Chưa nhập" onChange={price=>update(i,{price})}/> }
   <button type="button" className="icon-btn dish-remove" aria-label={`Xóa món ${i+1}`} onClick={()=>onChange(writeMenu(items.filter((_,index)=>index!==i),set))}><Trash2 size={16}/></button>
  </div>)}
  </div>
  <button type="button" className="text-btn dish-add" disabled={items.length>=80} onClick={()=>onChange(writeMenu([...items,newItem(editingSetTemplate)],set))}><Plus size={15}/>Thêm món</button>
  {priced.length>0&&<div className="dish-editor-total"><div><span>Tổng giá thực đơn đã nhập</span><strong>{money(total)}</strong></div>{onApplyTotal&&<button type="button" className="secondary-btn" disabled={!complete||total>100000000} onClick={()=>onApplyTotal(total)}>Dùng tổng món làm giá bàn</button>}{!complete&&<small>Nhập đủ giá và số lượng các món để áp dụng tổng vào giá bàn.</small>}</div>}
 </section>
}


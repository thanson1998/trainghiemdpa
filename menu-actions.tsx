import {useState} from 'react';
import {Trash2,RotateCcw,Undo2} from 'lucide-react';
import {readMenu,readMenuSet,writeMenu} from './menu';

export function MenuActions({value,onChange,tableCount=1,disabled=false}:{value:string;onChange:(value:string)=>void;tableCount?:number;disabled?:boolean}){
 const [undo,setUndo]=useState<{before:string;after:string;message:string}|null>(null);
 const set=readMenuSet(value),items=readMenu(value,tableCount);
 function clear(onlySet:boolean){
  const after=onlySet?writeMenu(items.filter(item=>!item.included)):'';
  setUndo({before:value,after,message:onlySet?'Đã xóa set và các món trong set. Giữ lại món gọi thêm.':'Đã làm mới menu.'});
  onChange(after);
 }
 return <div className="menu-actions-wrap"><div className="menu-actions">
  {set&&<button type="button" className="secondary-btn" disabled={disabled} onClick={()=>clear(true)}><Trash2 size={15}/>Xóa set</button>}
  <button type="button" className="secondary-btn" disabled={disabled||(!set&&!items.length)} onClick={()=>clear(false)}><RotateCcw size={15}/>Làm mới menu</button>
 </div>{undo&&value===undo.after&&<p className="menu-action-result" role="status">{undo.message} <button type="button" className="text-btn" disabled={disabled} onClick={()=>{onChange(undo.before);setUndo(null);}}><Undo2 size={14}/>Hoàn tác</button></p>}</div>;
}

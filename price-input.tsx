import {useLayoutEffect,useRef} from 'react';
import {formatUnitPrice,parseUnitPrice} from './menu';
export function PriceInput({value,onChange,label,placeholder,max=100000000,required=false}:{value:number|null;onChange:(value:number|null)=>void;label:string;placeholder?:string;max?:number;required?:boolean}){
 const input=useRef<HTMLInputElement>(null),caret=useRef<number|null>(null);
 useLayoutEffect(()=>{if(caret.current===null||!input.current)return;const text=input.current.value;let digits=0,position=0;while(position<text.length&&digits<caret.current){if(/\d/.test(text[position]))digits++;position++;}input.current.setSelectionRange(position,position);caret.current=null;});
 useLayoutEffect(()=>{input.current?.setCustomValidity(value!==null&&(value<0||value>max)?'Số tiền phải từ 0 đến '+formatUnitPrice(max)+' VNĐ.':'');},[value,max]);
 return <input ref={input} required={required} aria-label={label} type="text" inputMode="numeric" autoComplete="off" value={formatUnitPrice(value)} placeholder={placeholder} title={'Từ 0 đến '+formatUnitPrice(max)+' VNĐ'} onChange={event=>{const raw=event.target.value,next=parseUnitPrice(raw,max);if(next===undefined)return;caret.current=raw.slice(0,event.target.selectionStart??raw.length).replace(/\D/g,'').length;onChange(next);}}/>;
}

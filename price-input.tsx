import {useLayoutEffect,useRef} from 'react';
import {formatUnitPrice,parseUnitPrice} from './menu';
export function PriceInput({value,onChange,label,placeholder}:{value:number|null;onChange:(value:number|null)=>void;label:string;placeholder?:string}){
 const input=useRef<HTMLInputElement>(null),caret=useRef<number|null>(null);
 useLayoutEffect(()=>{if(caret.current===null||!input.current)return;const text=input.current.value;let digits=0,position=0;while(position<text.length&&digits<caret.current){if(/\d/.test(text[position]))digits++;position++;}input.current.setSelectionRange(position,position);caret.current=null;});
 return <input ref={input} aria-label={label} type="text" inputMode="numeric" autoComplete="off" value={formatUnitPrice(value)} placeholder={placeholder} title="Từ 0 đến 100,000,000 VNĐ" onChange={event=>{const raw=event.target.value,next=parseUnitPrice(raw);if(next===undefined)return;caret.current=raw.slice(0,event.target.selectionStart??raw.length).replace(/\D/g,'').length;onChange(next);}}/>;
}

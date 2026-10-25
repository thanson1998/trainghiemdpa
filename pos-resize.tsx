import {useEffect,useRef,useState,type CSSProperties,type PointerEvent,type KeyboardEvent,type RefObject} from 'react';
import './pos-resize.css';
const storageKey='dpa-pos-layout-v1';
type Layout={width?:number;info?:number};
type Axis='width'|'height'|'both';
const clamp=(v:number,min:number,max:number)=>Math.min(Math.max(min,max),Math.max(min,v));
function initial():Layout{try{const v=JSON.parse(localStorage.getItem(storageKey)||'{}');return {width:Number.isFinite(v.width)?clamp(v.width,25,80):undefined,info:Number.isFinite(v.info)?clamp(v.info,32,900):undefined};}catch{return {};}}
export function usePosResize(cart:RefObject<HTMLElement|null>){
 const workbench=useRef<HTMLDivElement>(null),info=useRef<HTMLDivElement>(null);
 const [layout,setLayout]=useState<Layout>(initial),[dragging,setDragging]=useState(false);
 const start=useRef<{x:number;y:number;width:number;height:number;axis:Axis}|null>(null);
 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(layout));}catch{}},[layout]);
 useEffect(()=>{document.body.classList.toggle('pos-is-resizing',dragging);return()=>document.body.classList.remove('pos-is-resizing');},[dragging]);
 function apply(axis:Axis,width:number,height:number){const root=workbench.current,body=cart.current?.querySelector('.pos-cart-body');if(!root)return;const available=root.clientWidth-14;setLayout(current=>({...current,...(axis!=='height'?{width:clamp(width,300,available-250)/available*100}:{}),...(axis!=='width'?{info:clamp(height,32,(body?.clientHeight||500)-170)}:{})}));}
 function down(e:PointerEvent<HTMLElement>,axis:Axis){if(e.button!==0||!matchMedia('(min-width:801px)').matches)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);start.current={x:e.clientX,y:e.clientY,width:cart.current?.clientWidth||400,height:info.current?.clientHeight||120,axis};setDragging(true);}
 function move(e:PointerEvent<HTMLElement>){const s=start.current;if(s)apply(s.axis,s.width+e.clientX-s.x,s.height+e.clientY-s.y);}
 function end(){start.current=null;setDragging(false);}
 function key(e:KeyboardEvent<HTMLElement>,axis:Axis){if(e.key==='Home'){e.preventDefault();setLayout({});return;}const dx=e.key==='ArrowLeft'?-24:e.key==='ArrowRight'?24:0,dy=e.key==='ArrowUp'?-20:e.key==='ArrowDown'?20:0;if((axis!=='height'&&dx)||(axis!=='width'&&dy)){e.preventDefault();apply(axis,(cart.current?.clientWidth||400)+dx,(info.current?.clientHeight||120)+dy);}}
 const handle=(axis:Axis)=>({onPointerDown:(e:PointerEvent<HTMLElement>)=>down(e,axis),onPointerMove:move,onPointerUp:end,onPointerCancel:end,onLostPointerCapture:end,onKeyDown:(e:KeyboardEvent<HTMLElement>)=>key(e,axis)});
 const style={'--pos-cart-width':layout.width===undefined?undefined:layout.width+'%','--pos-info-height':layout.info===undefined?undefined:layout.info+'px'} as CSSProperties;
 return {workbench,info,style,handle,reset:()=>setLayout({}),width:Math.round(layout.width??44),height:Math.round(layout.info??120)};
}

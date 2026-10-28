import {useCallback,useEffect,useRef,useState} from 'react';
import {applyZones,type Zone} from './model';
import {apiRequest} from './sync';
import {watchLiveSync} from './live-sync';
export type LayoutState={version:number;zones:Zone[]};
export function useTableLayout(){
 const [state,setState]=useState<LayoutState|null>(null),[error,setError]=useState('');
 const current=useRef(''),mounted=useRef(false),sequence=useRef(0);
 const accept=useCallback((next:LayoutState)=>{const text=JSON.stringify(next);if(text!==current.current){applyZones(next.zones);current.current=text;setState(next);}setError('');},[]);
 const load=useCallback(async()=>{const n=++sequence.current;try{const r=await apiRequest('/api/table-layout'),data=await r.json() as LayoutState&{error?:string};if(!r.ok)throw Error(data.error||'Chưa tải được sơ đồ bàn.');if(mounted.current&&n===sequence.current)accept(data);}catch(e){if(mounted.current&&n===sequence.current)setError(e instanceof Error?e.message:'Chưa tải được sơ đồ bàn.');}},[accept]);
 useEffect(()=>{mounted.current=true;void load();const stop=watchLiveSync(load,{intervalMs:15000});return()=>{mounted.current=false;sequence.current++;stop();};},[load]);
 const save=useCallback(async(draft:{id?:string;title:string;count:number;type:string}[],version:number)=>{const r=await apiRequest('/api/table-layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version,zones:draft})});const data=await r.json() as LayoutState&{error?:string};if(!r.ok)throw Error(data.error||'Chưa lưu được khu vực.');sequence.current++;if(mounted.current)accept(data);return data;},[accept]);
 return {state,error,load,save};
}

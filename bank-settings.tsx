import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {apiRequest} from './sync';
import {watchLiveSync} from './live-sync';
import {defaultBankSettings,type BankSettings} from './bank-model';
import {BankContext} from './bank-context';
export function BankSettingsProvider({children}:{children:ReactNode}){
 const [bank,setBank]=useState(defaultBankSettings),[loading,setLoading]=useState(true),[error,setError]=useState('');const sequence=useRef(0);
 const reload=useCallback(async()=>{const seq=++sequence.current;try{const r=await apiRequest('/api/pos/bank'),data=await r.json() as BankSettings&{error?:string};if(!r.ok)throw Error(data.error||'Chưa tải được tài khoản nhận tiền.');if(seq!==sequence.current)return;setBank(current=>JSON.stringify(current)===JSON.stringify(data)?current:data);setError('');}catch(e){if(seq===sequence.current)setError((e as Error).message);}finally{if(seq===sequence.current)setLoading(false);}},[]);
 useEffect(()=>{void reload();const stop=watchLiveSync(reload,{intervalMs:30000,idleIntervalMs:60000});return()=>{stop();sequence.current++;};},[reload]);
 const save=useCallback(async(next:BankSettings)=>{const r=await apiRequest('/api/pos/bank',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)}),data=await r.json() as BankSettings&{error?:string};if(!r.ok)throw Error(data.error||'Chưa lưu được tài khoản.');sequence.current++;setBank(data);setError('');setLoading(false);},[]);
 return <BankContext.Provider value={{bank,loading,error,reload,save}}>{children}</BankContext.Provider>;
}

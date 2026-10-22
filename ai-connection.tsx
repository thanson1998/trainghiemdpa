import {useEffect,useState} from 'react';
import {apiRequest} from './sync';
type State={configured:boolean;provider:string;model:string};
export function AiConnection(){
 const [state,setState]=useState<State|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false);
 useEffect(()=>{const abort=new AbortController();void apiRequest('/api/ai-status',{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('Chưa tải được cấu hình AI.');setState(await r.json() as State);}).catch(()=>{if(!abort.signal.aborted){setMessage('Chưa đọc được cấu hình AI.');setFailed(true);}});return()=>abort.abort();},[]);
 async function check(){setBusy(true);setMessage('');setFailed(false);try{const r=await apiRequest('/api/ai-check',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)}),j=await r.json() as {provider:string;model:string;message:string;error:string};if(!r.ok)throw Error(j.error);setState({configured:true,provider:j.provider,model:j.model});setMessage(j.message);}catch(e){setFailed(true);setMessage(e instanceof Error?e.message:'Chưa kết nối được AI.');}finally{setBusy(false);}}
 return <section className="ai-connection"><div><b>{state?(state.configured?'Đã cấu hình '+(state.provider==='gemini'?'Gemini':'Cloudflare AI'):'AI chưa được cấu hình'):'Đang kiểm tra cấu hình AI…'}</b>{state?.model&&<small>{state.model}</small>}</div><button type="button" className="secondary-btn" disabled={busy} onClick={check}>{busy?'Đang kiểm tra…':'Kiểm tra kết nối'}</button>{message&&<p role={failed?'alert':'status'} className={failed?'ai-failed':'ai-connected'}>{message}</p>}<small>Nút kiểm tra đọc một lời nhắn mẫu, không tạo đơn; lượt gọi vẫn tính theo nhà cung cấp.</small></section>;
}

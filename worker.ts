import {IMPORT,geminiModel,importModel} from './text-import';
import {GET_CATALOG,POST_CATALOG} from './catalog-api';
import {GET,POST,DELETE,MOVE,HISTORY,RESTORE,BACKUP,GET_PRINT,CONFIRM_PRINT} from './api';
interface Env {DB:D1Database;ASSETS:Fetcher;ALLOWED_ORIGIN?:string;GEMINI_API_KEY?:string;GEMINI_MODEL?:string;AI?:{run(model:string,input:Record<string,unknown>):Promise<unknown>}}
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  const origin=request.headers.get('Origin');
  const allowed=env.ALLOWED_ORIGIN||'https://thanson1998.github.io';
  const headers=new Headers({'Cache-Control':'no-store','Vary':'Origin'});
  if(origin===allowed||origin===url.origin){headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type');headers.set('Access-Control-Max-Age','600');}
  if(origin && origin!==allowed && origin!==url.origin)return Response.json({error:'Nguồn truy cập không được cấu hình.'},{status:403,headers});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!['/api/bookings','/api/catalog','/api/bookings/move','/api/import-text','/api/ai-status','/api/ai-check','/api/history','/api/history/restore','/api/backup','/api/bookings/prints'].includes(url.pathname))return Response.json({error:'Không tìm thấy chức năng.'},{status:404,headers});
  if(['POST','DELETE'].includes(request.method)&&!request.headers.get('Content-Type')?.toLowerCase().includes('application/json'))return Response.json({error:'Yêu cầu phải có định dạng JSON.'},{status:415,headers});
  if(['/api/ai-status','/api/ai-check'].includes(url.pathname)){
   let response:Response;
   if(url.pathname==='/api/ai-status'&&request.method==='GET')response=Response.json({provider:env.GEMINI_API_KEY?.trim()?'gemini':'cloudflare',model:env.GEMINI_API_KEY?.trim()?(env.GEMINI_MODEL?.trim()||geminiModel):importModel,configured:!!(env.GEMINI_API_KEY?.trim()||env.AI)});
   else if(url.pathname==='/api/ai-check'&&request.method==='POST'){
    const checked=await IMPORT(new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Kiểm tra kết nối, ngày 25/10/2026 từ 18:00 đến 21:00, bàn S1-07, 6 người. Gà hấp 2 đĩa, mỗi đĩa 320 nghìn.'})}),env);
    const data=await checked.json() as any;response=checked.ok?(data.fields?.tables?.includes('S1-07')&&data.fields?.price===640000?Response.json({ok:true,provider:data.provider,model:data.model,message:'Kết nối và đọc văn bản thành công. Không có đơn nào được lưu.'}):Response.json({error:'AI đã phản hồi nhưng chưa đọc đúng phiếu mẫu. Hãy thử kiểm tra lại. (Mã: AI_CHECK_INCOMPLETE)',code:'AI_CHECK_INCOMPLETE'},{status:422})):Response.json(data,{status:checked.status});
   }else response=Response.json({error:'Phương thức không được hỗ trợ.'},{status:405});
   const result=new Response(response.body,response);headers.forEach((v,k)=>result.headers.set(k,v));return result;
  }
  const extra:Record<string,Record<string,typeof GET>>={'/api/history':{GET:HISTORY},'/api/history/restore':{POST:RESTORE},'/api/backup':{GET:BACKUP},'/api/bookings/prints':{GET:GET_PRINT,POST:CONFIRM_PRINT}};
  if(extra[url.pathname]){const fn=extra[url.pathname][request.method];const response=fn?await fn(request,env.DB):Response.json({error:'Phương thức không được hỗ trợ.'},{status:405});const result=new Response(response.body,response);headers.forEach((v,k)=>result.headers.set(k,v));return result;}
  if(url.pathname==='/api/import-text'){const response=request.method==='POST'?await IMPORT(request,env):Response.json({error:'Chỉ hỗ trợ POST.'},{status:405,headers:{Allow:'POST, OPTIONS'}});const result=new Response(response.body,response);headers.forEach((v,k)=>result.headers.set(k,v));return result;}
  const routes:Record<string,((request:Request,db:D1Database)=>Promise<Response>)|undefined>=url.pathname==='/api/bookings/move'?{POST:MOVE}:url.pathname==='/api/catalog'?{GET:GET_CATALOG,POST:POST_CATALOG}:{GET,POST,DELETE};
  const action=routes[request.method];
  if(!action){headers.set('Allow',url.pathname==='/api/bookings/move'?'POST, OPTIONS':url.pathname==='/api/catalog'?'GET, POST, OPTIONS':'GET, POST, DELETE, OPTIONS');return Response.json({error:'Phương thức không được hỗ trợ.'},{status:405,headers});}
  const response=await action(request,env.DB);
  const result=new Response(response.body,response);
  headers.forEach((v,k)=>result.headers.set(k,v));
  return result;
 }
};

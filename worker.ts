import {telegramStatus,processBookingTelegrams,processTelegramChecks,processTelegramPayments,type TelegramEnv} from './telegram-reminders';
import {emailReminderStatus,saveEmailSchedule,sendTestBookingEmail,processBookingEmails,type EmailReminderEnv} from './email-reminders';
import {GET_ORDER_HISTORY} from './order-history-api';
import {GET_LAYOUT,SAVE_LAYOUT} from './table-layout-api';
import {GET_ADS_CONNECTION,CONNECT_ADS,GET_LIVE_ADS,SEARCH_LIVE_ADS} from './ads-live-api';
import {GET_ADS,SAVE_ADS} from './ads-api';
import {GET_BANK,SAVE_BANK,GET_SHIFT,SAVE_SHIFT} from './pos-tools-api';
import {GET_PAYMENTS,PAY,REVERSE_PAYMENT,REVERSAL_STATUS} from './payments-api';
import {GET_DISH_IMAGE,REQUEST_DISH_IMAGE,processDishImages,DISH_IMAGE_STATUS} from './dish-images-api';
import {IMPORT,geminiModel,importModel} from './text-import';
import {GET_CATALOG,POST_CATALOG} from './catalog-api';
import {GET,POST,DELETE,MOVE,HISTORY,RESTORE,BACKUP,GET_PRINT,CONFIRM_PRINT} from './api';
interface Env extends EmailReminderEnv,TelegramEnv {SEARCHAPI_API_KEY?:string;DB:D1Database;ASSETS:Fetcher;ALLOWED_ORIGIN?:string;GEMINI_API_KEY?:string;GEMINI_MODEL?:string;DISH_IMAGES_DAILY_LIMIT?:string;DISH_IMAGES_ENABLED?:string;AI?:{run(model:string,input:Record<string,unknown>):Promise<unknown>}}
export default {
 async scheduled(_event:ScheduledController,env:Env,ctx:ExecutionContext){ctx.waitUntil(processDishImages(env));ctx.waitUntil(processBookingEmails(env));ctx.waitUntil(processBookingTelegrams(env));ctx.waitUntil(processTelegramChecks(env));ctx.waitUntil(processTelegramPayments(env));},
 async fetch(request:Request,env:Env,ctx?:ExecutionContext):Promise<Response>{
  const url=new URL(request.url);
  url.pathname=({'/api/market-connection':'/api/ads-connection','/api/market-feed':'/api/ads-live','/api/market-research':'/api/ads-research'} as Record<string,string>)[url.pathname]||url.pathname;
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  const origin=request.headers.get('Origin');
  const allowed=env.ALLOWED_ORIGIN||'https://thanson1998.github.io';
  const headers=new Headers({'Cache-Control':'no-store','Vary':'Origin'});
  if(origin===allowed||origin===url.origin){headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type');headers.set('Access-Control-Max-Age','600');}
  if(origin && origin!==allowed && origin!==url.origin)return Response.json({error:'Ngu?n truy c?p kh�ng du?c c?u h�nh.'},{status:403,headers});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(url.pathname==='/api/telegram-reminders'){const response=request.method==='GET'?await telegramStatus(env):Response.json({error:'Method not allowed'},{status:405});const result=new Response(response.body,response);headers.forEach((v,k)=>result.headers.set(k,v));return result;}
  if(url.pathname==='/api/email-reminders/test'){const response=request.method!=='POST'?Response.json({error:'Ch? h? tr? POST.'},{status:405}):!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')?Response.json({error:'Y�u c?u ph?i c� d?nh d?ng JSON.'},{status:415}):await sendTestBookingEmail(request,env);const result=new Response(response.body,response);headers.forEach((v,k)=>result.headers.set(k,v));return result;}
  if(url.pathname==='/api/email-reminders'){if(request.method==='POST'&&!request.headers.get('Content-Type')?.toLowerCase().includes('application/json'))return Response.json({error:'Y�u c?u ph?i c� d?nh d?ng JSON.'},{status:415,headers});const response=request.method==='GET'?await emailReminderStatus(env):request.method==='POST'?await saveEmailSchedule(request,env):Response.json({error:'Phuong th?c kh�ng du?c h? tr?.'},{status:405});const result=new Response(response.body,response);headers.forEach((v,k)=>result.headers.set(k,v));return result;}
  if(url.pathname==='/api/dish-images'||url.pathname.startsWith('/api/dish-images/')){
   if(request.method==='GET'&&url.pathname.startsWith('/api/dish-images/')&&typeof caches!=='undefined'){
    const edgeCache=(caches as unknown as {default?:Cache}).default;
    if(edgeCache){
     const cached=await edgeCache.match(request).catch(()=>undefined);
     const response=cached||await GET_DISH_IMAGE(request,env.DB);
     if(!cached&&response.status===200&&ctx)ctx.waitUntil(edgeCache.put(request,response.clone()).catch(()=>{}));
     const result=new Response(response.body,response);headers.forEach((v,k)=>{if(k!=='cache-control')result.headers.set(k,v)});return result;
    }
   }
   if(request.method==='POST'&&!request.headers.get('Content-Type')?.toLowerCase().includes('application/json'))return Response.json({error:'Y�u c?u ph?i c� d?nh d?ng JSON.'},{status:415,headers});
   const response=url.pathname==='/api/dish-images'&&request.method==='GET'?await DISH_IMAGE_STATUS(env):url.pathname==='/api/dish-images'&&request.method==='POST'?await REQUEST_DISH_IMAGE(request,env):url.pathname.startsWith('/api/dish-images/')&&request.method==='GET'?await GET_DISH_IMAGE(request,env.DB):Response.json({error:'Phuong th?c kh�ng du?c h? tr?.'},{status:405});
   const result=new Response(response.body,response);headers.forEach((v,k)=>{if(k!=='cache-control')result.headers.set(k,v)});return result;
  }
  if(['/api/ads-connection','/api/ads-live'].includes(url.pathname)){
   if(request.method==='POST'&&!request.headers.get('Content-Type')?.includes('application/json'))return Response.json({error:'Y�u c?u ph?i c� d?nh d?ng JSON.'},{status:415,headers});
   const response=url.pathname==='/api/ads-connection'?(request.method==='GET'?await GET_ADS_CONNECTION(request,env):request.method==='POST'?await CONNECT_ADS(request,env):Response.json({error:'Phuong th?c kh�ng h? tr?.'},{status:405})):(request.method==='GET'?await GET_LIVE_ADS(request,env):request.method==='POST'?await SEARCH_LIVE_ADS(request,env):Response.json({error:'Phuong th?c kh�ng h? tr?.'},{status:405}));const result=new Response(response.body,response);headers.forEach((v,k)=>result.headers.set(k,v));return result;
  }
  if(!['/api/order-history','/api/table-layout','/api/ads-research','/api/pos/bank','/api/pos/shift','/api/bookings','/api/catalog','/api/bookings/move','/api/import-text','/api/ai-status','/api/ai-check','/api/history','/api/history/restore','/api/backup','/api/bookings/prints','/api/payments','/api/payments/reverse'].includes(url.pathname))return Response.json({error:'Kh�ng t�m th?y ch?c nang.'},{status:404,headers});
  if(['POST','DELETE'].includes(request.method)&&!request.headers.get('Content-Type')?.toLowerCase().includes('application/json'))return Response.json({error:'Y�u c?u ph?i c� d?nh d?ng JSON.'},{status:415,headers});
  if(['/api/ai-status','/api/ai-check'].includes(url.pathname)){
   let response:Response;
   if(url.pathname==='/api/ai-status'&&request.method==='GET')response=Response.json({provider:env.GEMINI_API_KEY?.trim()?'gemini':'cloudflare',model:env.GEMINI_API_KEY?.trim()?(env.GEMINI_MODEL?.trim()||geminiModel):importModel,configured:!!(env.GEMINI_API_KEY?.trim()||env.AI)});
   else if(url.pathname==='/api/ai-check'&&request.method==='POST'){
    const checked=await IMPORT(new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Ki?m tra k?t n?i, ng�y 25/10/2026 t? 18:00 d?n 21:00, b�n S1-07, 6 ngu?i. G� h?p 2 dia, m?i dia 320 ngh�n.'})}),env);
    const data=await checked.json() as any;response=checked.ok?(data.fields?.tables?.includes('S1-07')&&data.fields?.price===640000?Response.json({ok:true,provider:data.provider,model:data.model,message:'K?t n?i v� d?c van b?n th�nh c�ng. Kh�ng c� don n�o du?c luu.'}):Response.json({error:'AI da ph?n h?i nhung chua d?c d�ng phi?u m?u. Hay th? ki?m tra l?i. (Ma: AI_CHECK_INCOMPLETE)',code:'AI_CHECK_INCOMPLETE'},{status:422})):Response.json(data,{status:checked.status});
   }else response=Response.json({error:'Phuong th?c kh�ng du?c h? tr?.'},{status:405});
   const result=new Response(response.body,response);headers.forEach((v,k)=>result.headers.set(k,v));return result;
  }
  const extra:Record<string,Record<string,typeof GET>>={'/api/order-history':{GET:GET_ORDER_HISTORY},'/api/table-layout':{GET:GET_LAYOUT,POST:SAVE_LAYOUT},'/api/ads-research':{GET:GET_ADS,POST:SAVE_ADS},'/api/pos/bank':{GET:GET_BANK,POST:SAVE_BANK},'/api/pos/shift':{GET:GET_SHIFT,POST:SAVE_SHIFT},'/api/payments/reverse':{GET:REVERSAL_STATUS,POST:REVERSE_PAYMENT},'/api/payments':{GET:GET_PAYMENTS,POST:PAY},'/api/history':{GET:HISTORY},'/api/history/restore':{POST:RESTORE},'/api/backup':{GET:BACKUP},'/api/bookings/prints':{GET:GET_PRINT,POST:CONFIRM_PRINT}};
  if(extra[url.pathname]){const fn=extra[url.pathname][request.method];const response=fn?await fn(request,env.DB):Response.json({error:'Phuong th?c kh�ng du?c h? tr?.'},{status:405});if(url.pathname==='/api/payments'&&request.method==='POST'&&response.ok&&ctx)ctx.waitUntil(processTelegramPayments(env).catch(()=>console.error('Telegram payment notice deferred to cron')));const result=new Response(response.body,response);headers.forEach((v,k)=>result.headers.set(k,v));return result;}
  if(url.pathname==='/api/import-text'){const response=request.method==='POST'?await IMPORT(request,env):Response.json({error:'Ch? h? tr? POST.'},{status:405,headers:{Allow:'POST, OPTIONS'}});const result=new Response(response.body,response);headers.forEach((v,k)=>result.headers.set(k,v));return result;}
  const routes:Record<string,((request:Request,db:D1Database)=>Promise<Response>)|undefined>=url.pathname==='/api/bookings/move'?{POST:MOVE}:url.pathname==='/api/catalog'?{GET:GET_CATALOG,POST:POST_CATALOG}:{GET,POST,DELETE};
  const action=routes[request.method];
  if(!action){headers.set('Allow',url.pathname==='/api/bookings/move'?'POST, OPTIONS':url.pathname==='/api/catalog'?'GET, POST, OPTIONS':'GET, POST, DELETE, OPTIONS');return Response.json({error:'Phuong th?c kh�ng du?c h? tr?.'},{status:405,headers});}
  const response=await action(request,env.DB);
  const result=new Response(response.body,response);
  headers.forEach((v,k)=>result.headers.set(k,v));
  return result;
 }
};
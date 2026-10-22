import {IMPORT} from './text-import';
import {GET_CATALOG,POST_CATALOG} from './catalog-api';
import {GET,POST,DELETE,MOVE} from './api';
interface Env {DB:D1Database;ASSETS:Fetcher;ALLOWED_ORIGIN?:string;AI?:{run(model:string,input:Record<string,unknown>):Promise<unknown>}}
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
  if(!['/api/bookings','/api/catalog','/api/bookings/move','/api/import-text'].includes(url.pathname))return Response.json({error:'Không tìm thấy chức năng.'},{status:404,headers});
  if(['POST','DELETE'].includes(request.method)&&!request.headers.get('Content-Type')?.toLowerCase().includes('application/json'))return Response.json({error:'Yêu cầu phải có định dạng JSON.'},{status:415,headers});
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

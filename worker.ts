import {GET,POST,DELETE} from './api';
interface Env {DB:D1Database;ASSETS:Fetcher;ALLOWED_ORIGIN?:string}
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
  if(url.pathname!=='/api/bookings')return Response.json({error:'Không tìm thấy chức năng.'},{status:404,headers});
  if(['POST','DELETE'].includes(request.method)&&!request.headers.get('Content-Type')?.toLowerCase().includes('application/json'))return Response.json({error:'Yêu cầu phải có định dạng JSON.'},{status:415,headers});
  const action={GET,POST,DELETE}[request.method as 'GET'|'POST'|'DELETE'];
  if(!action){headers.set('Allow','GET, POST, DELETE, OPTIONS');return Response.json({error:'Phương thức không được hỗ trợ.'},{status:405,headers});}
  const response=await action(request,env.DB);
  const result=new Response(response.body,response);
  headers.forEach((v,k)=>result.headers.set(k,v));
  return result;
 }
};

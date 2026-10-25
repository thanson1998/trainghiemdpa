import type {LiveAd,LiveSearch} from './ads-live-model';
export interface AdsEnv {DB:D1Database;SEARCHAPI_API_KEY?:string}
const LIMIT=3,CACHE_MS=12*3600000;
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
const output=(data:unknown,status=200)=>Response.json(data,{status});
const clip=(v:unknown,n=4000)=>typeof v==='string'?v.slice(0,n):'';
const https=(v:unknown)=>{try{const u=new URL(String(v));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
function failure(status:number){return status===401?'Khóa SearchApi không hợp lệ.':status===403?'SearchApi chưa cấp quyền cho API Thư viện quảng cáo trên tài khoản này.':status===429?'SearchApi đã hết lượt hoặc đang giới hạn tốc độ. Thử lại sau.':'SearchApi chưa trả được quảng cáo. Kết quả trước vẫn được giữ.';}
export function normalizeAds(raw:any,query:string):LiveSearch{
 const rows:Array<any>=Array.isArray(raw.ads)?raw.ads:[];const seen=new Set<string>(),ads:LiveAd[]=[];
 for(const r of rows){const id=String(r.ad_archive_id||'');if(!/^\d+$/.test(id)||seen.has(id))continue;seen.add(id);const s=r.snapshot||{},card=s.cards?.[0]||{},video=s.videos?.[0]||{},image=s.images?.[0]||{};
 const imageUrl=https(image.resized_image_url||image.original_image_url||card.resized_image_url||card.original_image_url||video.video_preview_image_url),videoUrl=https(video.video_hd_url||video.video_sd_url);
 const date=clip(r.start_date,10);ads.push({id,pageId:clip(String(r.page_id||s.page_id||''),40),pageName:clip(r.page_name||s.page_name||'Trang quảng cáo',160),pageUrl:https(s.page_profile_uri),body:clip(s.body?.text||card.body),title:clip(s.title?.includes?.('{{')?card.title:s.title||card.title,300),imageUrl,videoUrl,startDate:/^\d{4}-\d{2}-\d{2}$/.test(date)?date:'',active:r.is_active===true,url:'https://www.facebook.com/ads/library/?id='+id,format:videoUrl||s.display_format==='VIDEO'?'Video':imageUrl?'Ảnh':'Khác'});
 if(ads.length>=100)break;
 }
 return {query,fetchedAt:new Date().toISOString(),total:typeof raw.search_information?.total_results==='number'?raw.search_information.total_results:null,ads,hasMore:!!raw.pagination?.next_page_token};
}
async function keyFor(env:AdsEnv){return env.SEARCHAPI_API_KEY?.trim()||(await env.DB.prepare('SELECT api_key FROM ads_connection WHERE id=1').first<{api_key:string}>())?.api_key||'';}
export async function GET_ADS_CONNECTION(req:Request,env:AdsEnv){try{
 const row=await env.DB.prepare('SELECT api_key,public_jwk,configured_at,remaining_credits FROM ads_connection WHERE id=1').first<any>();const configured=!!(env.SEARCHAPI_API_KEY?.trim()||row?.api_key);const used=await env.DB.prepare('SELECT used FROM ads_search_budget WHERE day=?').bind(day()).first<{used:number}>();
 if(!configured&&new URL(req.url).searchParams.get('setup')==='public'){
  if(!row?.public_jwk){const keys=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);const [privateJwk,publicJwk]=await Promise.all([crypto.subtle.exportKey('jwk',keys.privateKey),crypto.subtle.exportKey('jwk',keys.publicKey)]);await env.DB.prepare('INSERT INTO ads_connection(id,private_jwk,public_jwk) VALUES(1,?,?) ON CONFLICT(id) DO NOTHING').bind(JSON.stringify(privateJwk),JSON.stringify(publicJwk)).run();}
  const pub=await env.DB.prepare('SELECT public_jwk FROM ads_connection WHERE id=1').first<{public_jwk:string}>();return output({configured:false,setupPublicKey:JSON.parse(pub!.public_jwk)});
 }
 return output({configured,provider:'SearchApi · Meta Ad Library',remainingCredits:row?.remaining_credits??null,dailyLimit:LIMIT,usedToday:used?.used||0});
 }catch{return output({error:'Chưa đọc được trạng thái kết nối quảng cáo.'},503);}}
// One-time encrypted bootstrap. Only a locally held random capability can configure the key.
const SETUP_TOKEN_SHA256='c6c09da35d64748739a40bceff69083d50685edc059ab767a3cb6c0ef9a3fbe5';
export async function CONNECT_ADS(req:Request,env:AdsEnv){try{
 if((req.headers.get('Content-Length')&&Number(req.headers.get('Content-Length'))>3000))return output({error:'Yêu cầu không hợp lệ.'},400);
 const row=await env.DB.prepare('SELECT api_key,private_jwk FROM ads_connection WHERE id=1').first<any>();if(env.SEARCHAPI_API_KEY||row?.api_key)return output({error:'Kết nối đã được cấu hình.'},409);if(!row?.private_jwk)return output({error:'Chưa khởi tạo kênh cấu hình.'},409);
 const text=await req.text();if(text.length>3000)return output({error:'Yêu cầu không hợp lệ.'},400);const {sealed}=JSON.parse(text);if(typeof sealed!=='string'||sealed.length>1000)return output({error:'Yêu cầu không hợp lệ.'},400);
 const key=await crypto.subtle.importKey('jwk',JSON.parse(row.private_jwk),{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);const plain=await crypto.subtle.decrypt('RSA-OAEP',key,Uint8Array.from(atob(sealed),c=>c.charCodeAt(0)));const config=JSON.parse(new TextDecoder().decode(plain));
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(config.token||'')))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==SETUP_TOKEN_SHA256||typeof config.key!=='string'||!/^[\w-]{12,160}$/.test(config.key))return output({error:'Không được phép cấu hình kết nối.'},403);
 const checked=await fetch('https://www.searchapi.io/api/v1/me',{headers:{Authorization:'Bearer '+config.key},signal:AbortSignal.timeout(25000)});if(!checked.ok)return output({error:failure(checked.status)},checked.status===401||checked.status===403?422:503);const account=await checked.json() as any;
 const remaining=typeof account.account?.remaining_credits==='number'?account.account.remaining_credits:null;
 const saved=await env.DB.prepare("UPDATE ads_connection SET api_key=?,configured_at=?,remaining_credits=?,private_jwk='',public_jwk='' WHERE id=1 AND api_key='' AND private_jwk=?").bind(config.key,new Date().toISOString(),remaining,row.private_jwk).run();return saved.meta.changes?output({configured:true,accountVerified:true,remainingCredits:remaining}):output({error:'Kết nối vừa được cấu hình từ phiên khác.'},409);
 }catch{return output({error:'Chưa xác thực được kết nối SearchApi.'},503);}}
export async function GET_LIVE_ADS(_req:Request,env:AdsEnv){try{const {results}=await env.DB.prepare("SELECT data FROM ads_live_cache WHERE data<>'' ORDER BY fetched_at DESC").all<{data:string}>();return output({searches:results.map(r=>JSON.parse(r.data))});}catch{return output({error:'Chưa tải được kết quả quảng cáo.'},503);}}
export async function SEARCH_LIVE_ADS(req:Request,env:AdsEnv){
 let query='';try{
 const body=await req.json() as any;query=typeof body.query==='string'?body.query.trim():'';if(query.length<2||query.length>120)return output({error:'Nhập từ khóa từ 2–120 ký tự.'},400);
 const apiKey=await keyFor(env);if(!apiKey)return output({error:'Chưa cấu hình khóa SearchApi ở máy chủ.',code:'NOT_CONFIGURED'},503);
 const cached=await env.DB.prepare('SELECT data,fetched_at FROM ads_live_cache WHERE query=?').bind(query).first<{data:string;fetched_at:string}>();if(cached?.data&&Date.now()-Date.parse(cached.fetched_at)<CACHE_MS)return output({...JSON.parse(cached.data),cached:true});
 await env.DB.prepare('INSERT INTO ads_live_cache(query) VALUES(?) ON CONFLICT(query) DO NOTHING').bind(query).run();const locked=await env.DB.prepare('UPDATE ads_live_cache SET lease_until=? WHERE query=? AND lease_until<?').bind(Date.now()+70000,query,Date.now()).run();if(!locked.meta.changes)return output({error:'Từ khóa đang được tìm trên thiết bị khác. Chờ một chút rồi tải lại.'},429);
 const budget=await env.DB.prepare('INSERT INTO ads_search_budget(day,used) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET used=used+1 WHERE used<? RETURNING used').bind(day(),LIMIT).first();if(!budget){await env.DB.prepare('UPDATE ads_live_cache SET lease_until=0 WHERE query=?').bind(query).run();return output({error:'Đã dùng 3 lượt tìm hôm nay để bảo vệ lượt API. Các kết quả đã lấy vẫn xem được; ngày mai có thể tìm tiếp.',code:'DAILY_LIMIT'},429);}
 const url=new URL('https://www.searchapi.io/api/v1/search');url.search=new URLSearchParams({engine:'meta_ad_library',q:query,country:'VN',active_status:'active',ad_type:'all'}).toString();const response=await fetch(url,{headers:{Authorization:'Bearer '+apiKey},signal:AbortSignal.timeout(55000)});
 if(!response.ok){await env.DB.prepare('UPDATE ads_live_cache SET lease_until=0,error=? WHERE query=?').bind(failure(response.status),query).run();return output({error:failure(response.status),providerStatus:response.status},502);}
 const raw=await response.json() as any;if(raw.error||!Array.isArray(raw.ads)&&typeof raw.search_information?.total_results!=='number'){await env.DB.prepare('UPDATE ads_live_cache SET lease_until=0,error=? WHERE query=?').bind('SearchApi trả dữ liệu chưa hợp lệ.',query).run();return output({error:'SearchApi chưa trả được danh sách quảng cáo hợp lệ.'},502);}
 const result=normalizeAds(raw,query);await env.DB.prepare('UPDATE ads_live_cache SET data=?,fetched_at=?,lease_until=0,error=? WHERE query=?').bind(JSON.stringify(result),result.fetchedAt,'',query).run();return output(result);
 }catch{if(query)await env.DB.prepare('UPDATE ads_live_cache SET lease_until=0 WHERE query=?').bind(query).run().catch(()=>{});return output({error:'Kết nối SearchApi bị gián đoạn. Kết quả cũ vẫn được giữ; chờ rồi thử lại.'},503);}}

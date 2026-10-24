import {imageNameKey,isIllustratedDish,dishImagePrompt} from './dish-image-model';
import type {CatalogDish} from './catalog-model';
export interface DishImageEnv {DB:D1Database;AI?:{run(model:string,input:Record<string,unknown>):Promise<unknown>};DISH_IMAGES_DAILY_LIMIT?:string;DISH_IMAGES_ENABLED?:string}
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const message='Chưa tạo được ảnh riêng. Ảnh minh họa nhóm vẫn hiển thị; có thể thử lại trong Thư viện thực đơn.';
type ImageRow={dish_id:string;name_key:string;status:'queued'|'generating'|'ready'|'error';updated_at:number;has_image:number;error:string};
export async function DISH_IMAGE_STATUS(env:DishImageEnv){
 try{const {results}=await env.DB.prepare('SELECT status,COUNT(*) AS count FROM dish_images GROUP BY status').all<{status:string;count:number}>();return json({feature:'dish-images-v2',enabled:!!env.AI&&env.DISH_IMAGES_ENABLED!=='false',counts:Object.fromEntries(results.map(r=>[r.status,r.count]))});}catch{return json({error:'Máy chủ chưa cập nhật phần lưu ảnh.'},503);}
}
async function readDishes(db:D1Database):Promise<CatalogDish[]>{const row=await db.prepare('SELECT data FROM menu_catalog WHERE id=?').bind('dpa-shared').first<{data:string}>();return row?JSON.parse(row.data).dishes:[];}
export async function attachDishImages(db:D1Database,dishes:CatalogDish[]){
 try{
  const {results}=await db.prepare('SELECT dish_id,name_key,status,updated_at,image IS NOT NULL AS has_image,error FROM dish_images').all<ImageRow>();
  const images=new Map(results.map(row=>[row.dish_id,row]));
  return dishes.map(d=>{const row=images.get(d.id);return {...d,image:row&&row.name_key===imageNameKey(d.name)?{status:row.status,...(row.has_image?{url:`/api/dish-images/${d.id}?v=${row.updated_at+1}`}:{ }),...(row.error?{message:row.error}:{})}:undefined};});
 }catch{return dishes;} // Older servers remain usable until the migration is applied.
}
export async function GET_DISH_IMAGE(request:Request,db:D1Database){
 const id=new URL(request.url).pathname.split('/').pop();
 if(!id||!/^[-\da-f]{36}$/i.test(id))return json({error:'Không tìm thấy ảnh.'},404);
 try{
  const dish=(await readDishes(db)).find(d=>d.id===id);
  if(!dish)return json({error:'Món không còn trong thư viện.'},404);
  const row=await db.prepare('SELECT image,updated_at FROM dish_images WHERE dish_id=? AND name_key=? AND image IS NOT NULL').bind(id,imageNameKey(dish.name)).first<{image:number[]|ArrayBuffer|Uint8Array;updated_at:number}>();
  if(!row)return json({error:'Ảnh riêng chưa sẵn sàng.'},404);
  // D1 returns BLOB columns as number[], unlike node:sqlite's Uint8Array.
  const bytes=row.image instanceof ArrayBuffer?new Uint8Array(row.image):Uint8Array.from(row.image);
  if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return json({error:'Ảnh lưu chưa hợp lệ. Hãy yêu cầu tạo lại ảnh.'},503);
  const etag='"dish-v2-'+id+'-'+row.updated_at+'"';
  const headers={'Content-Type':'image/jpeg','Cache-Control':'public, max-age=86400','Content-Length':String(bytes.byteLength),'ETag':etag,'X-Content-Type-Options':'nosniff'};
  if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers});
  return new Response(bytes.buffer,{headers});
 }catch{return json({error:'Chưa tải được ảnh.'},503);}
}
export async function REQUEST_DISH_IMAGE(request:Request,env:DishImageEnv){
 try{
  const body=await request.json() as {id?:unknown};
  if(typeof body.id!=='string'||!/^[-\da-f]{36}$/i.test(body.id))return json({error:'Món không hợp lệ.'},400);
  const dish=(await readDishes(env.DB)).find(d=>d.id===body.id);
  if(!dish||!isIllustratedDish(dish.name))return json({error:'Chọn một món ăn hoặc đồ uống đã lưu.'},404);
  if(!env.AI||env.DISH_IMAGES_ENABLED==='false')return json({error:'Dịch vụ tạo ảnh chưa được bật trên máy chủ.'},503);
  const now=Date.now(),key=imageNameKey(dish.name);
  const result=await env.DB.prepare(`INSERT INTO dish_images(dish_id,name_key,requested_at) VALUES(?,?,?)
   ON CONFLICT(dish_id) DO UPDATE SET name_key=excluded.name_key,status='queued',attempts=0,next_attempt=0,lease=NULL,error='',requested_at=excluded.requested_at,
   image=CASE WHEN dish_images.name_key=excluded.name_key THEN dish_images.image ELSE NULL END
   WHERE dish_images.requested_at<? AND dish_images.status!='generating'`).bind(dish.id,key,now,now-300000).run();
  if(!result.meta.changes)return json({error:'Ảnh đã được xếp hàng hoặc đang tạo. Vui lòng chờ ít nhất 5 phút trước khi tạo lại.'},429);
  return json({ok:true,message:'Đã xếp hàng tạo ảnh. Ảnh mới sẽ tự xuất hiện sau khi hoàn tất.'},202);
 }catch{return json({error:'Chưa xếp hàng tạo ảnh được. Kiểm tra máy chủ rồi thử lại.'},503);}
}
// Cron owns generation. Public reads and browser refreshes never trigger paid AI calls.
// A single leased worker and an atomic daily counter bound work across all devices.
export async function processDishImages(env:DishImageEnv){
 if(!env.AI||env.DISH_IMAGES_ENABLED==='false')return;
 const now=Date.now(),token=crypto.randomUUID();let locked=false,cooldown=false;
 try{
  const lock=await env.DB.prepare('UPDATE dish_image_lock SET lease=?,expires=? WHERE id=1 AND expires<?').bind(token,now+600000,now).run();
  if(!lock.meta.changes)return;locked=true;
  await env.DB.prepare("DELETE FROM dish_images WHERE dish_id NOT IN (SELECT json_extract(value,'$.id') FROM menu_catalog,json_each(menu_catalog.data,'$.dishes') WHERE menu_catalog.id='dpa-shared')").run();
  const dishes=(await readDishes(env.DB)).filter(d=>isIllustratedDish(d.name));
  if(!dishes.length)return;
  const {results:old}=await env.DB.prepare('SELECT dish_id,name_key FROM dish_images').all<{dish_id:string;name_key:string}>();
  const prior=new Map(old.map(row=>[row.dish_id,row.name_key]));
  const queue=dishes.filter(d=>prior.get(d.id)!==imageNameKey(d.name)).slice(0,15).map(d=>env.DB.prepare(`INSERT INTO dish_images(dish_id,name_key) VALUES(?,?) ON CONFLICT(dish_id) DO UPDATE SET name_key=excluded.name_key,status='queued',image=NULL,attempts=0,next_attempt=0,lease=NULL,error='',updated_at=0`).bind(d.id,imageNameKey(d.name)));
  // Stay below the free-plan query budget, including generation and state updates.
  if(queue.length)await env.DB.batch(queue);
  await env.DB.prepare("UPDATE dish_images SET status='queued',lease=NULL WHERE status='generating' AND next_attempt<?").bind(now).run();
  const {results:pending}=await env.DB.prepare("SELECT dish_id,name_key FROM dish_images WHERE status IN ('queued','error') AND attempts<3 AND next_attempt<=? ORDER BY requested_at DESC, rowid DESC").bind(now).all<{dish_id:string;name_key:string}>();
  let count=0;
  for(const job of pending){
   if(count>=3)break;
   const dish=dishes.find(d=>d.id===job.dish_id&&imageNameKey(d.name)===job.name_key);if(!dish)continue;
   const day=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'});
   const configured=Number(env.DISH_IMAGES_DAILY_LIMIT??'300'),limit=Number.isFinite(configured)?Math.max(0,Math.min(1000,Math.floor(configured))):300;
   if(!limit)break;
   const usage=await env.DB.prepare('INSERT INTO dish_image_usage(day,attempts) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1 WHERE attempts<?').bind(day,limit).run();
   if(!usage.meta.changes)break;
   const claimed=await env.DB.prepare("UPDATE dish_images SET status='generating',attempts=attempts+1,lease=?,next_attempt=? WHERE dish_id=? AND name_key=? AND status IN ('queued','error')").bind(token,Date.now()+600000,dish.id,job.name_key).run();
   if(!claimed.meta.changes)continue;count++;
   try{
    const generated=await env.AI.run('@cf/black-forest-labs/flux-1-schnell',{prompt:dishImagePrompt(dish.name,dish.category),steps:4}) as {image?:unknown};
    if(typeof generated.image!=='string'||generated.image.length>2500000)throw Error('Invalid image');
    const bytes=Uint8Array.from(atob(generated.image),c=>c.charCodeAt(0));
    if(bytes.length<4||bytes.length>1800000||bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)throw Error('Invalid JPEG');
    // A concurrent rename must not attach artwork to the wrong dish.
    const current=(await readDishes(env.DB)).find(d=>d.id===dish.id);
    if(!current||imageNameKey(current.name)!==job.name_key){await env.DB.prepare('DELETE FROM dish_images WHERE dish_id=? AND lease=?').bind(dish.id,token).run();continue;}
    await env.DB.prepare("UPDATE dish_images SET status='ready',image=?,updated_at=?,error='',lease=NULL,next_attempt=0 WHERE dish_id=? AND name_key=? AND lease=?").bind(bytes.buffer,Date.now(),dish.id,job.name_key,token).run();
   }catch{
    await env.DB.prepare("UPDATE dish_images SET status='error',error=?,lease=NULL,next_attempt=? WHERE dish_id=? AND lease=?").bind(message,Date.now()+3600000,dish.id,token).run();
    cooldown=true;break;
   }
  }
 }catch{console.warn('Dish image background work unavailable.');}
 finally{if(locked)await env.DB.prepare('UPDATE dish_image_lock SET expires=?,lease=NULL WHERE id=1 AND lease=?').bind(cooldown?Date.now()+900000:0,token).run().catch(()=>{});}
}

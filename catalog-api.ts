import {z} from 'zod';
import {validMenu,readMenu,normalizeUnit} from './menu';
const schema=z.object({version:z.number().int().min(0),dishes:z.array(z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(200),unit:z.string().trim().min(1).max(30).transform(normalizeUnit),price:z.number().int().min(0).max(100000000).nullable()})).max(500).refine(items=>new Set(items.map(x=>x.id)).size===items.length),templates:z.array(z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(100),menu:z.string().max(40000).refine(validMenu).refine(value=>(value.startsWith('DPA_MENU_V1:')||value.startsWith('DPA_MENU_V2:'))&&readMenu(value).some(x=>x.name.trim()))})).max(100).refine(items=>new Set(items.map(x=>x.id)).size===items.length)});
const out=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET_CATALOG(_req:Request,db:D1Database){
 try{const {results}=await db.prepare('SELECT * FROM menu_catalog WHERE id=?').bind('dpa-shared').all<any>();const row=results[0];const catalog=row?JSON.parse(row.data):null;if(catalog)catalog.dishes=catalog.dishes.map((d:any)=>({...d,unit:normalizeUnit(d.unit)}));return out(row?{...catalog,version:row.version}:{dishes:[],templates:[],version:0});}catch{return out({error:'Không tải được thư viện thực đơn.'},503)}
}
export async function POST_CATALOG(req:Request,db:D1Database){
 try{const parsed=schema.safeParse(await req.json());if(!parsed.success)return out({error:'Kiểm tra tên, đơn vị, giá món và thực đơn mẫu trước khi lưu.'},400);const {version,...catalog}=parsed.data;const data=JSON.stringify(catalog),now=new Date().toISOString();
 const result=version===0?await db.prepare('INSERT INTO menu_catalog (id,data,version,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind('dpa-shared',data,now).run():await db.prepare('UPDATE menu_catalog SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(data,now,'dpa-shared',version).run();
 if(!result.meta.changes)return out({error:'Thư viện vừa thay đổi trên thiết bị khác. Tải lại thư viện rồi lưu lại.'},409);return out({...catalog,version:version+1});
 }catch{return out({error:'Chưa lưu được thư viện. Vui lòng thử lại.'},503)}
}

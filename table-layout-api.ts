import {defaultZones,type Zone} from './model';
import {z} from 'zod';
const out=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export type TableLayout={version:number;zones:Zone[]};
export async function readTableLayout(db:D1Database):Promise<TableLayout>{
 const row=await db.prepare("SELECT data,version FROM table_layout WHERE id='dpa-shared'").first<{data:string;version:number}>();
 if(!row)throw Error('TABLE_LAYOUT_MISSING');
 return {zones:JSON.parse(row.data),version:row.version};
}
export async function GET_LAYOUT(_req:Request,db:D1Database){try{return out(await readTableLayout(db));}catch{return out({error:'Chưa tải được cấu hình khu vực và bàn. Vui lòng tải lại.'},503);}}
const schema=z.object({version:z.number().int().positive(),zones:z.array(z.object({id:z.string().max(30).optional(),title:z.string().trim().min(1).max(80),count:z.number().int().min(1).max(100),type:z.enum(['inside','outdoor','patio'])})).min(1).max(50)});
export async function SAVE_LAYOUT(req:Request,db:D1Database){
 try{
  const parsed=schema.safeParse(await req.json());if(!parsed.success)return out({error:'Nhập tên khu vực (tối đa 80 ký tự), từ 1–100 bàn/khu, tối đa 50 khu vực.'},400);
  const input=parsed.data,current=await readTableLayout(db);if(input.version!==current.version)return out({error:'Sơ đồ vừa được sửa trên thiết bị khác. Tải lại cấu hình trước khi lưu.'},409);
  const named=new Set<string>(),ids=new Set<string>();let nextId=1;
  const next:Zone[]=[];
  for(const draft of input.zones){
   const key=draft.title.normalize('NFC').toLocaleLowerCase('vi');if(named.has(key))return out({error:'Tên khu vực không được trùng nhau.'},400);named.add(key);
   let id=draft.id||'';const existing=current.zones.find(z=>z.id===id);
   if(id&&!existing)return out({error:'Khu vực không tồn tại. Tải lại cấu hình.'},400);
   if(!id){while(current.zones.some(z=>z.id==='K'+nextId)||ids.has('K'+nextId))nextId++;id='K'+nextId++;}
   if(ids.has(id))return out({error:'Khu vực bị lặp. Tải lại cấu hình.'},400);ids.add(id);
   const tables=(existing?.tables??[]).slice(0,draft.count);
   for(let index=tables.length;index<draft.count;index++)tables.push(defaultZones.find(z=>z.id===id)?.tables[index]??(id+'-'+String(index+1).padStart(2,'0')));
   next.push({id,title:draft.title,count:draft.count,type:draft.type,sub:existing?.sub||(draft.type==='inside'?'Không gian trong nhà':draft.type==='patio'?'Sân vườn':'Ngoài trời'),tables});
  }
  if(current.zones.some(z=>!ids.has(z.id)))return out({error:'Không xóa khu vực hiện có. Bạn có thể đổi tên hoặc chỉnh số bàn.'},400);
  const all=next.flatMap(z=>z.tables);if(all.length>1000||new Set(all).size!==all.length)return out({error:'Tối đa 1,000 bàn và mã bàn không được trùng.'},400);
  const result=await db.prepare("UPDATE table_layout SET data=?,version=version+1,updated_at=? WHERE id='dpa-shared' AND version=?").bind(JSON.stringify(next),new Date().toISOString(),input.version).run();
  if(!result.meta.changes)return out({error:'Sơ đồ vừa thay đổi. Tải lại trước khi lưu.'},409);
  return out({version:input.version+1,zones:next});
 }catch(e){if(String(e).includes('TABLE_IN_USE'))return out({error:'Không thể giảm số bàn vì có bàn đã được dùng trong đơn hoặc lịch sử. Giữ lại các bàn đó để bảo toàn dữ liệu.'},409);return out({error:'Chưa lưu được khu vực. Vui lòng tải lại và kiểm tra trước khi thử lại.'},503);}
}
export async function validConfiguredTables(db:D1Database,tables:string[]){const layout=await readTableLayout(db),allowed=new Set(layout.zones.flatMap(z=>z.tables));return tables.every(id=>allowed.has(id));}

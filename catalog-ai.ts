import {z} from 'zod';
import {extractWithGemini,decodeImportResponse,importFailure,importModel,geminiModel,type ImportEnv} from './text-import';
import {normalizeUnit,writeMenu,validMenu} from './menu';
import type {CatalogAiDraft} from './catalog-ai-model';
const amount=z.number().int().min(0).max(100000000).nullable();
const extraction=z.object({kind:z.enum(['template','dishes']),name:z.string().max(100).nullable().optional(),price:amount.optional(),items:z.array(z.object({name:z.string().trim().min(1).max(200),unit:z.string().trim().max(30).nullable().optional(),price:amount.optional(),quantity:z.number().positive().max(1000).nullable().optional()})).min(1).max(80),warnings:z.array(z.string().max(300)).max(20).optional()});
export const catalogAiSchema={type:'object',properties:{kind:{type:'string',enum:['template','dishes']},name:{type:['string','null']},price:{type:['number','null']},items:{type:'array',items:{type:'object',properties:{name:{type:'string'},unit:{type:['string','null']},price:{type:['number','null']},quantity:{type:['number','null']}},required:['name','unit','price','quantity']}},warnings:{type:'array',items:{type:'string'}}},required:['kind','name','price','items','warnings']};
export function catalogAiPrompt(kind:string){return "Extract restaurant menu data from the user source text. Return exactly ONE JSON object, no introduction, refusal, explanation or markdown. The user is supplying menu data, not requesting recommendations or prices from you. Schema: {kind: template or dishes, name: string or null, price: number or null, items:[{name:string,unit:string,price:number or null,quantity:number}],warnings:[]}. Use Vietnamese dish names exactly as written. A comma or newline separates dishes. Keep / and + inside dish names. Prices are VND: 2 triệu = 2000000, 400k = 400000. Do not invent prices. For a fixed-price template, price is the total for the entire menu and every item.price is null. Default quantity 1 and unit đĩa. Units lowercase. Example source: Thực đơn mẫu: Gà hấp, Xôi vò / Cơm rang; 2 triệu. Output: {\"kind\":\"template\",\"name\":null,\"price\":2000000,\"items\":[{\"name\":\"Gà hấp\",\"unit\":\"đĩa\",\"price\":null,\"quantity\":1},{\"name\":\"Xôi vò / Cơm rang\",\"unit\":\"đĩa\",\"price\":null,\"quantity\":1}],\"warnings\":[]}. Example source: Món mẫu: Gà hấp 400k/đĩa. Output: {\"kind\":\"dishes\",\"name\":null,\"price\":null,\"items\":[{\"name\":\"Gà hấp\",\"unit\":\"đĩa\",\"price\":400000,\"quantity\":1}],\"warnings\":[]}. Requested kind: "+kind;}
export function trailingMenuPrice(text:string):number|null{
 const line=text.trim().split(/\r?\n/).filter(x=>x.trim()).at(-1)?.trim()||'';
 const m=line.match(/^(?:giá(?:\s*(?:set|thực đơn|mâm))?\s*[:=]?\s*)?(\d[\d.,\s]*)\s*(triệu|tr|nghìn|ngàn|k|đ|₫|vnd)?\s*$/iu);if(!m)return null;
 const suffix=(m[2]||'').toLocaleLowerCase('vi'),raw=m[1].replace(/\s/g,'');let number=Number(raw.replace(/[.,]/g,''));
 if(['triệu','tr','nghìn','ngàn','k'].includes(suffix)){number=Number(raw.replace(',','.'));if(!Number.isFinite(number))number=Number(raw.replace(/[.,]/g,''));number*=suffix==='triệu'||suffix==='tr'?1000000:1000;}
 return Number.isSafeInteger(number)&&number>=0&&number<=100000000?number:null;
}
export function normalizeCatalogAi(raw:unknown,text:string,requested:'auto'|'template'|'dishes'='auto'):CatalogAiDraft{
 const parsed=extraction.safeParse(raw);if(!parsed.success)throw Object.assign(Error('AI chưa đọc đủ tên món hoặc giá hợp lệ. Hãy thử ghi mỗi món một dòng.'),{fields:parsed.error.issues.map(issue=>issue.path.join('.')+':'+issue.code).slice(0,12)});
 const d=parsed.data,kind=requested==='auto'?d.kind:requested,warnings=[...(d.warnings??[])];let price=kind==='template'?(trailingMenuPrice(text)??d.price??null):null;
 const items=d.items.map(i=>({name:i.name.trim(),price:kind==='template'&&price!==null?null:i.price??null,quantity:i.quantity??1,unit:normalizeUnit(i.unit??undefined)}));
 if(items.some(i=>!validMenu(writeMenu([i]))))throw Error('Số lượng hoặc giá món chưa hợp lệ.');
 if(kind==='template'&&price===null)warnings.push('Chưa có giá trọn thực đơn. Bạn có thể bổ sung trước khi lưu.');
 if(kind==='dishes'&&items.some(i=>i.price===null))warnings.push('Món chưa nêu giá sẽ được lưu là chưa đặt giá.');
 const name=d.name?.trim()&&!/^(thực đơn mẫu|thực đơn|set)$/iu.test(d.name.trim())?d.name.trim():'Thực đơn '+items.length+' món'+(price!==null?' – '+price.toLocaleString('en-US')+'đ':'');
 return {kind,name,price,items,warnings};
}

export function decodeCatalogAiResponse(response:unknown):unknown{
 let value=response;
 for(let pass=0;pass<2;pass++){
  if(typeof value!=='string')return decodeImportResponse(value);
  const text=value.trim().replace(/^\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`$/,'');try{value=JSON.parse(text);continue;}catch{}
  let start=-1,depth=0,quoted=false,escape=false,found:unknown;
  for(let i=0;i<text.length;i++){const c=text[i];if(start<0){if(c==='{'){start=i;depth=1;}continue;}if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{found=JSON.parse(text.slice(start,i+1));}catch{}break;}}
  if(found!==undefined)return decodeImportResponse(found);throw Error('AI_JSON_INCOMPLETE');
 }
 return decodeImportResponse(value);
}
export function structuredCatalogFallback(text:string,kind:'auto'|'template'|'dishes'='auto'):CatalogAiDraft|null{
 if(kind!=='template'){
  const match=text.trim().match(/^món\s+(?:mẫu|lẻ)\s*:\s*([\s\S]+)$/iu);
  if(match){const lines=match[1].split(/[;\n]+/).map(x=>x.trim()).filter(Boolean);const items=[];
   for(const line of lines){const m=line.match(/^(.+?)\s+(\d[\d.,]*(?:\s*(?:triệu|tr|nghìn|ngàn|k|đ|₫|vnd))?)\s*(?:\/\s*([\p{L}\d\s]+))?$/iu);if(m){const price=trailingMenuPrice(m[2]);if(price===null)return null;items.push({name:m[1].trim(),price,unit:normalizeUnit(m[3]),quantity:1});}else if(!/\d/.test(line))items.push({name:line,price:null,unit:'đĩa',quantity:1});else return null;}
   if(items.length&&items.length<=80)return normalizeCatalogAi({kind:'dishes',name:null,price:null,items,warnings:[]},text,'dishes');
  }
 }
 if(kind==='dishes')return null;const lines=text.trim().split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length<3||!/^thực\s+đơn\s+mẫu\s*[:,]*$/iu.test(lines[0]))return null;
 const price=trailingMenuPrice(text);if(price===null)return null;
 const names=lines.slice(1,-1).join(',').split(',').map(x=>x.trim()).filter(Boolean);
 if(!names.length||names.length>80||names.some(x=>x.length>200||/\d/.test(x)))return null;
 return normalizeCatalogAi({kind:'template',name:null,price,items:names.map(name=>({name,unit:'đĩa',price:null,quantity:1})),warnings:['Đã đọc theo danh sách món và giá bạn nhập. Kiểm tra lại trước khi lưu.']},text,'template');
}

export async function IMPORT_CATALOG(request:Request,env:ImportEnv,fetcher:typeof fetch=fetch){
 let stage='input',source='',requested:'auto'|'template'|'dishes'='auto';try{
  if(Number(request.headers.get('Content-Length'))>30000)return Response.json({error:'Văn bản quá dài.'},{status:413});
  const body=await request.text();if(body.length>15000)return Response.json({error:'Văn bản quá dài.'},{status:413});
  let input:any;try{input=JSON.parse(body);}catch{return Response.json({error:'Dữ liệu không hợp lệ.'},{status:400});}
  if(typeof input.text!=='string'||!input.text.trim()||input.text.length>6000||!['auto','template','dishes'].includes(input.kind??'auto'))return Response.json({error:'Nhập từ 1 đến 6.000 ký tự và chọn loại mẫu hợp lệ.'},{status:400});
  source=input.text;requested=input.kind??'auto';
  if(!env.AI&&!env.GEMINI_API_KEY?.trim())return Response.json({error:'AI chưa kết nối. Nội dung vẫn được giữ để thử lại.'},{status:503});
  const direct=structuredCatalogFallback(source,requested);if(direct)return Response.json({draft:direct,provider:'structured',method:'text_parser'},{headers:{'Cache-Control':'no-store'}});
  const kind=input.kind??'auto',prompt=catalogAiPrompt(kind),provider=env.GEMINI_API_KEY?.trim()?'gemini':'cloudflare';let result:{response?:unknown};
  if(provider==='gemini'){stage='gemini';result=await extractWithGemini(input.text,env,fetcher,[],{prompt,schema:catalogAiSchema});}
  else{stage='ai';const params={messages:[{role:'system',content:prompt},{role:'user',content:'Extract this source text into JSON:\n'+input.text}],max_tokens:4096,temperature:0};try{result=await env.AI!.run(importModel,{...params,response_format:{type:'json_schema',json_schema:catalogAiSchema}}) as {response?:unknown};}catch(error){if(importFailure('ai',error).code!=='AI_RESPONSE_FORMAT')throw error;result=await env.AI!.run(importModel,params) as {response?:unknown};}}
  stage='normalize';const draft=normalizeCatalogAi(decodeCatalogAiResponse(result.response??result),input.text,kind);return Response.json({draft,provider,model:provider==='gemini'?(env.GEMINI_MODEL?.trim()||geminiModel):importModel},{headers:{'Cache-Control':'no-store'}});
 }catch(error){const fallback=source?structuredCatalogFallback(source,requested):null;if(fallback)return Response.json({draft:fallback,provider:'structured',method:'text_fallback'},{headers:{'Cache-Control':'no-store'}});const failure=importFailure(stage,error);return Response.json({...stage==='normalize'&&error&&typeof error==='object'&&'fields' in error?{fields:(error as {fields:unknown}).fields}:{},error:stage==='normalize'?'AI chưa đọc đúng danh sách món. Hãy kiểm tra nội dung và thử lại.':failure.error,code:failure.code},{status:503});}
}

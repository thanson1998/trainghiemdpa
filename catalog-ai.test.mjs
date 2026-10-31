import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),loaded=new Map();
function resolve(spec){if(!spec.startsWith('./'))return pathToFileURL(require.resolve(spec)).href;if(loaded.has(spec))return loaded.get(spec);const file=[spec+'.ts',spec+'.tsx'].find(fs.existsSync);const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from ['"]([^'"]+)['"]/g,(_,s)=>'from '+JSON.stringify(resolve(s)));const url='data:text/javascript;base64,'+Buffer.from(output).toString('base64');loaded.set(spec,url);return url;}
const api=await import(resolve('./catalog-ai')),model=await import(resolve('./catalog-ai-model')),menu=await import(resolve('./menu'));
const names=['Gà hấp lá chanh','Chim câu quay','Lợn mán nướng','Tôm chiên xù','Vịt xào','Bò sốt tiêu + bánh mỳ','Sake chiên','Rau xào','Xa lát rau','Canh cua cà','Xôi vò / Cơm rang','Tráng miệng','Canh miến'];
const naturalText='Xin thêm thực đơn gồm '+names.join(', ')+'. Giá trọn gói 2 triệu.';
const text='Thực đơn mẫu:\n'+names.join(', ')+'\n2 triệu';
const raw={kind:'template',name:null,price:2,items:names.map(name=>({name,price:999999,unit:'Đĩa',quantity:1})),warnings:[]};
const empty=()=>({version:7,dishes:[],templates:[]});
const req=(value,method='POST')=>new Request('https://dpa.example/api/catalog/import',{method,body:typeof value==='string'?value:JSON.stringify(value),headers:{'Content-Type':'application/json'}});
test('the requested menu has all 13 dishes and a two-million fixed price without priced extras',()=>{
 const draft=api.normalizeCatalogAi(raw,text);assert.equal(draft.kind,'template');assert.equal(draft.price,2000000);assert.equal(draft.items.length,13);assert.deepEqual(draft.items.map(i=>i.name),names);assert.ok(draft.items.every(i=>i.price===null&&i.unit==='đĩa'));
 const result=model.mergeAiCatalog(empty(),draft);assert.equal(result.added,1);assert.equal(result.catalog.templates.length,1);assert.equal(result.catalog.dishes.length,0);
 const value=result.catalog.templates[0].menu;assert.equal(menu.readMenuSet(value).pricePerTable,2000000);assert.equal(menu.menuSum(value),2000000);assert.equal(menu.readMenu(value).length,13);assert.ok(menu.readMenu(value).every(i=>i.included&&i.price===null));assert.equal(menu.readMenu(value)[10].name,'Xôi vò / Cơm rang');assert.equal(menu.readMenu(value)[5].name,'Bò sốt tiêu + bánh mỳ');
 assert.equal(model.mergeAiCatalog(result.catalog,draft).added,0);
});
test('Vietnamese price suffixes, missing prices and explicit kind overrides are handled',()=>{
 for(const [value,expected] of [['2 triệu',2000000],['2tr',2000000],['2,5 triệu',2500000],['2.000.000đ',2000000],['2000k',2000000],['Giá set: 250 nghìn',250000],['0đ',0],['',null],['Gà 2 con',null]])assert.equal(api.trailingMenuPrice(value),expected,value);
 const draft=api.normalizeCatalogAi({...raw,price:null},'Thực đơn mẫu\nGà, rau');assert.equal(draft.price,null);assert.ok(draft.warnings.length);
 const dishes=api.normalizeCatalogAi({...raw,items:[{name:'Nước',unit:'CHAI',price:null}]},'Nước','dishes');assert.equal(dishes.kind,'dishes');assert.equal(dishes.price,null);assert.equal(dishes.items[0].unit,'chai');assert.equal(dishes.items[0].price,null);assert.ok(dishes.warnings.length);
});
test('dish merging retains existing prices and metadata and never overwrites duplicate names',()=>{
 const existing={id:crypto.randomUUID(),name:'Gà hấp lá chanh',unit:'đĩa',price:400000,pinned:true,category:'Món ăn'};const catalog={...empty(),dishes:[existing]};
 const draft={kind:'dishes',name:'',price:null,items:[{name:'  GÀ HẤP LÁ CHANH ',unit:'ĐĨA',price:100},{name:'Món mới',unit:'BÁT',price:null},{name:'món mới',unit:'bát',price:200}],warnings:[]};
 const result=model.mergeAiCatalog(catalog,draft);assert.equal(result.added,1);assert.equal(result.skipped,2);assert.deepEqual(result.catalog.dishes.find(d=>d.id===existing.id),existing);assert.deepEqual(catalog.dishes,[existing]);assert.equal(result.catalog.dishes[0].unit,'bát');assert.equal(result.catalog.dishes[0].price,null);assert.equal(result.catalog.version,7);
});
test('template name collisions, invalid items and library limits are rejected without mutations',()=>{
 const draft=api.normalizeCatalogAi(raw,text),first=model.mergeAiCatalog(empty(),draft).catalog;
 assert.throws(()=>model.mergeAiCatalog(first,{...draft,price:3000000}),/đổi tên/);
 assert.throws(()=>model.mergeAiCatalog(empty(),{...draft,items:[{name:'',price:null}]}),/Kiểm tra/);
 assert.throws(()=>model.mergeAiCatalog(empty(),{...draft,price:-1}),/Kiểm tra/);
 assert.throws(()=>model.mergeAiCatalog({...empty(),templates:Array.from({length:100},(_,i)=>({id:crypto.randomUUID(),name:'Set '+i,menu:''}))},draft),/100/);
 assert.throws(()=>api.normalizeCatalogAi({...raw,items:[]},text),/AI/);
 assert.throws(()=>api.normalizeCatalogAi({...raw,items:[{name:'Gà',price:-100}]},text),/AI/);
});
test('Cloudflare extraction uses a catalog prompt, returns only a preview and never writes the database',async()=>{
 let dbCalls=0,aiCalls=0;const env={DB:{prepare(){dbCalls++;throw Error('no writes allowed')}},AI:{async run(_model,params){aiCalls++;assert.match(params.messages[0].content,/restaurant menu data/);assert.deepEqual(params.response_format.json_schema,api.catalogAiSchema);return {response:JSON.stringify({...raw,price:2000000})};}}};
 const r=await api.IMPORT_CATALOG(req({text:naturalText}),env);assert.equal(r.status,200);const result=await r.json();assert.equal(result.draft.price,2000000);assert.equal(result.draft.items.length,13);assert.equal(aiCalls,1);assert.equal(dbCalls,0);assert.equal(result.provider,'cloudflare');
});
test('Gemini uses the existing connection with catalog-specific output schema and safely handles failures',async()=>{
 let aiCalls=0;const env={DB:{},GEMINI_API_KEY:'secret-not-for-output',AI:{async run(){aiCalls++;throw Error('wrong provider')}}};
 const r=await api.IMPORT_CATALOG(req({text:naturalText}),env,async(_url,opts)=>{const data=JSON.parse(opts.body);assert.match(data.system_instruction.parts[0].text,/restaurant menu data/);assert.deepEqual(data.generationConfig.responseFormat.text.schema,api.catalogAiSchema);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(raw)}]}}]});});assert.equal(r.status,200);assert.equal((await r.json()).provider,'gemini');assert.equal(aiCalls,0);
 const failed=await api.IMPORT_CATALOG(req({text:'Thêm giúp tôi một món gà giá bốn trăm nghìn'}),env,async()=>Response.json({error:{message:'API key not valid secret-not-for-output'}},{status:403}));assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('secret-not-for-output'));
});
test('bad requests and invalid model replies never create catalog records',async()=>{
 let calls=0;const env={DB:{prepare(){throw Error('no database access')}},AI:{async run(){calls++;return {response:'not JSON'};}}};
 for(const input of [{text:''},{text:'x'.repeat(6001)},{text,kind:'booking'}])assert.equal((await api.IMPORT_CATALOG(req(input),env)).status,400);
 assert.equal((await api.IMPORT_CATALOG(req('{broken'),env)).status,400);assert.equal(calls,0);
 assert.equal((await api.IMPORT_CATALOG(req({text:'Thêm giúp tôi một món gà giá bốn trăm nghìn'}),env)).status,503);assert.equal(calls,1);
 assert.equal((await api.IMPORT_CATALOG(req({text}),{DB:{}})).status,503);
});

test('AI preview merges into the real catalog save, preserves older samples and keeps concurrent-save protection',async()=>{
 const {DatabaseSync}=await import('node:sqlite'),sql=new DatabaseSync(':memory:');
 for(const file of ['0001_reservations.sql','0002_menu_catalog_deposit.sql','0011_dish_images.sql'])sql.exec(fs.readFileSync(file,'utf8'));
 const db={prepare(query){const statement=sql.prepare(query);const bound=(args=[])=>({bind(...next){return bound(next)},async all(){return {results:statement.all(...args)}},async first(){return statement.get(...args)},async run(){return {meta:{changes:statement.run(...args).changes}}}});return bound();}};
 const catalogApi=await import(resolve('./catalog-api')),old={version:0,dishes:[{id:crypto.randomUUID(),name:'Gà cũ',unit:'đĩa',price:321000,pinned:true}],templates:[]};
 const before=await(await catalogApi.POST_CATALOG(req(old),db)).json();const merged=model.mergeAiCatalog(before,api.normalizeCatalogAi(raw,text));
 const saved=await catalogApi.POST_CATALOG(req(merged.catalog),db);assert.equal(saved.status,200);const after=await saved.json();assert.equal(after.templates.length,1);assert.deepEqual(after.dishes[0],before.dishes[0]);assert.equal(menu.readMenu(after.templates[0].menu).length,13);assert.equal(menu.menuSum(after.templates[0].menu),2000000);assert.equal(sql.prepare('SELECT COUNT(*) n FROM reservations').get().n,0);
 assert.equal((await catalogApi.POST_CATALOG(req(merged.catalog),db)).status,409);sql.close();
});

test('catalog AI accepts JSON with a preamble and preserves braces and escaped quotes inside dish names',()=>{
 const data={...raw,items:[{name:'Món {đặc biệt} \"A\"',unit:'đĩa',price:null,quantity:1}]};assert.deepEqual(api.decodeCatalogAiResponse('Kết quả:\n'+JSON.stringify(data)+'\nXong'),{...data,tables:[]});assert.deepEqual(api.decodeCatalogAiResponse(JSON.stringify(JSON.stringify(raw))),{...raw,tables:[]});assert.throws(()=>api.decodeCatalogAiResponse('Kết quả: {\"items\": ['),/INCOMPLETE/);
});
test('a malformed AI result still reads the exact explicit menu list without inventing prices or splitting alternatives',async()=>{
 const response=await api.IMPORT_CATALOG(req({text}),{DB:{prepare(){throw Error('no writes')}},AI:{async run(){return {response:'not JSON'};}}});assert.equal(response.status,200);const value=await response.json();assert.equal(value.method,'text_parser');assert.equal(value.draft.price,2000000);assert.deepEqual(value.draft.items.map(i=>i.name),names);assert.equal(api.structuredCatalogFallback('Món mẫu: Gà hấp 400k','dishes').items[0].price,400000);
});

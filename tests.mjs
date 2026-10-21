import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const dataUrl=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const modelUrl=dataUrl(compile(fs.readFileSync(new URL('./model.ts',import.meta.url),'utf8')));
const menuUrl=dataUrl(compile(fs.readFileSync(new URL('./menu.ts',import.meta.url),'utf8')));
const menu=await import(menuUrl);
const source=fs.readFileSync(new URL('./api.ts',import.meta.url),'utf8').replace("'./model'",JSON.stringify(modelUrl)).replace("'./menu'",JSON.stringify(menuUrl)).replace("'zod'",JSON.stringify(pathToFileURL(require.resolve('zod')).href));
const api=await import(dataUrl(compile(source)));
const catalogSource=fs.readFileSync(new URL('./catalog-api.ts',import.meta.url),'utf8').replace("'./menu'",JSON.stringify(menuUrl)).replace("'zod'",JSON.stringify(pathToFileURL(require.resolve('zod')).href));
const catalogApi=await import(dataUrl(compile(catalogSource)));
const worker=await import(dataUrl(compile(fs.readFileSync(new URL('./worker.ts',import.meta.url),'utf8').replace("'./api'",JSON.stringify(dataUrl(compile(source)))).replace("'./catalog-api'",JSON.stringify(dataUrl(compile(catalogSource)))))));
const printSource=fs.readFileSync(new URL('./print-menu.tsx',import.meta.url),'utf8').replace("'./model'",JSON.stringify(modelUrl)).replace("'./menu'",JSON.stringify(menuUrl)).replace("'react'",JSON.stringify(pathToFileURL(require.resolve('react')).href)).replace("'lucide-react'",JSON.stringify(pathToFileURL(require.resolve('lucide-react')).href));
const printModule=await import(dataUrl(compile(printSource).replace('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href))));
let sqlite,db;
beforeEach(()=>{
 sqlite=new DatabaseSync(':memory:');
 sqlite.exec(fs.readFileSync(new URL('./0001_reservations.sql',import.meta.url),'utf8'));
 sqlite.exec(fs.readFileSync(new URL('./0002_menu_catalog_deposit.sql',import.meta.url),'utf8'));

 db={prepare(sql){const statement=sqlite.prepare(sql);return{bind(...values){return{async all(){return{results:statement.all(...values)}},async run(){return{meta:{changes:statement.run(...values).changes}}}}}}}};
});
afterEach(()=>sqlite.close());
const booking=(extra={})=>({id:crypto.randomUUID(),date:'2026-10-25',start:'11:00',end:'14:00',name:'Chị Hương',phone:'0900000000',tables:['S1-01'],people:10,platters:1,price:1500000,menu:'Gà hấp\nLẩu cá tầm',note:'',status:'reserved',version:0,...extra});
const req=(method,data)=>new Request('https://dpa.example/api/bookings',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const get=()=>api.GET(new Request('https://dpa.example/api/bookings?date=2026-10-25'),db);
test('anonymous clients share bookings and price is per table',async()=>{
 const b=booking({tables:['S1-01','S1-02']});assert.equal((await api.POST(req('POST',b),db)).status,200);
 const first=await(await get()).json();assert.equal(first.bookings[0].name,'Chị Hương');assert.equal(first.bookings[0].price,1500000);
 const second=await(await get()).json();assert.deepEqual(second.bookings,first.bookings);assert.equal(second.bookings[0].version,1);
});
test('overlapping bookings are refused, adjacent times and other tables allowed',async()=>{
 assert.equal((await api.POST(req('POST',booking()),db)).status,200);
 assert.equal((await api.POST(req('POST',booking({start:'13:30',end:'15:00'})),db)).status,409);
 assert.equal((await api.POST(req('POST',booking({start:'14:00',end:'16:00'})),db)).status,200);
 assert.equal((await api.POST(req('POST',booking({tables:['N1-01']})),db)).status,200);
});
test('stale edits and stale deletes cannot overwrite another device',async()=>{
 const b=booking();await api.POST(req('POST',b),db);
 assert.equal((await api.POST(req('POST',{...b,name:'Anh Nam',version:1}),db)).status,200);
 assert.equal((await api.POST(req('POST',{...b,name:'Bản cũ',version:1}),db)).status,409);
 assert.equal((await api.DELETE(req('DELETE',{id:b.id,version:1}),db)).status,409);
 assert.equal((await api.DELETE(req('DELETE',{id:b.id,version:2}),db)).status,200);
 assert.equal((await(await get()).json()).bookings.length,0);
});
test('cancellation releases the table, invalid data are rejected',async()=>{
 const b=booking();await api.POST(req('POST',b),db);
 assert.equal((await api.POST(req('POST',{...b,status:'cancelled',version:1}),db)).status,200);
 assert.equal((await api.POST(req('POST',booking()),db)).status,200);
 for(const patch of [{tables:['UNKNOWN']},{tables:['7','7']},{date:'2026-02-30'},{end:'10:00'},{people:0},{price:-1}])assert.equal((await api.POST(req('POST',booking(patch)),db)).status,400);
});
test('CORS preflight and API requests support GitHub Pages',async()=>{
 const env={DB:db,ASSETS:{fetch:()=>new Response('asset')}};
 const origin='https://thanson1998.github.io';
 const preflight=await worker.default.fetch(new Request('https://dpa.example/api/bookings',{method:'OPTIONS',headers:{Origin:origin}}),env);
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
 const response=await worker.default.fetch(new Request('https://dpa.example/api/bookings?date=2026-10-25',{headers:{Origin:origin}}),env);
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const invalid=await worker.default.fetch(new Request('https://dpa.example/api/bookings',{method:'PATCH'}),env);assert.equal(invalid.status,405);
});
test('front-cashier tables 20, 19 and 18 support bookings and overlap protection',async()=>{
 const b=booking({tables:['20','19','18']});
 assert.equal((await api.POST(req('POST',b),db)).status,200);
 const saved=await(await get()).json();assert.deepEqual(saved.bookings[0].tables,['20','19','18']);
 assert.equal((await api.POST(req('POST',booking({tables:['19']})),db)).status,409);
});
test('menu print includes table locations, guests, dishes and correct per-table and total amounts',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const b=booking({tables:['20','19','18'],people:10,platters:2,price:1200000,menu:'Gà hấp\nLẩu cá tầm\n<script>alert(1)</script>'});
 const html=renderToStaticMarkup(React.createElement(printModule.MenuPrintPreview,{booking:b,onClose:()=>{}}));
 const text=html.replace(/<[^>]*>/g,'');
 for(const expected of ['Chị Hương','Trước quầy thanh toán','Bàn 20 · Bàn 19 · Bàn 18','30 người','10 người / bàn','6 mâm','Gà hấp','Lẩu cá tầm',new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(1200000),new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(3600000)])assert.ok(text.includes(expected),'Missing print content: '+expected);
 assert.ok(!html.includes('<script>alert(1)</script>'));
});

test('dish prices round trip through shared storage and legacy menus remain readable',async()=>{
 assert.deepEqual(menu.readMenu('Gà hấp\nLẩu cá'),[{name:'Gà hấp',price:null},{name:'Lẩu cá',price:null}]);
 const value=menu.writeMenu([{name:'Gà hấp',price:240000},{name:'Trà',price:0},{name:'Lẩu cá',price:null}]);
 assert.equal(menu.validMenu(value),true);assert.equal(menu.menuSum(value),240000);
 assert.ok(menu.menuText(value).includes('Gà hấp'));assert.ok(!menu.menuText(value).includes('DPA_MENU'));
 const b=booking({menu:value});assert.equal((await api.POST(req('POST',b),db)).status,200);
 assert.equal((await(await get()).json()).bookings[0].menu,value);
 for(const item of [{name:'Món',price:-1},{name:'Món',price:1.5},{name:'',price:1000}])assert.equal((await api.POST(req('POST',booking({tables:['19'],menu:menu.writeMenu([item])})),db)).status,400);
});
test('80mm receipt retains dish prices and negotiated table total',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const b=booking({tables:['20','19','18'],price:1200000,menu:menu.writeMenu([{name:'Gà hấp',price:240000},{name:'Tôm',price:180000}])});
 const html=renderToStaticMarkup(React.createElement(printModule.MenuPrintPreview,{booking:b,onClose:()=>{}}));
 assert.match(html,/size: 80mm/);assert.ok(html.includes('Gà hấp'));
 for(const amount of [240000,180000,420000,1200000,3600000])assert.ok(html.includes(new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(amount)));
 const css=fs.readFileSync(new URL('./menu-print.css',import.meta.url),'utf8');assert.ok(css.includes('width:80mm'));assert.ok(!css.includes('A4'));
});

test('monthly list includes all dates, sorts chronologically and excludes adjacent months',async()=>{
 const records=[booking({date:'2026-09-30'}),booking({date:'2026-10-31'}),booking({date:'2026-10-01',start:'18:00',end:'20:00'}),booking({date:'2026-10-01',start:'10:00',end:'12:00'}),booking({date:'2026-11-01'})];
 for(const b of records)assert.equal((await api.POST(req('POST',b),db)).status,200);
 const response=await api.GET(new Request('https://dpa.example/api/bookings?month=2026-10'),db);assert.equal(response.status,200);
 const result=(await response.json()).bookings;assert.deepEqual(result.map(b=>[b.date,b.start]),[['2026-10-01','10:00'],['2026-10-01','18:00'],['2026-10-31','11:00']]);
 const day=await api.GET(new Request('https://dpa.example/api/bookings?date=2026-10-01'),db);assert.equal((await day.json()).bookings.length,2);
 for(const query of ['month=2026-13','month=2026-00','month=2026-1','date=2026-02-30','month=2026-10&date=2026-10-01'])assert.equal((await api.GET(new Request('https://dpa.example/api/bookings?'+query),db)).status,400);
});
test('monthly list handles December, leap February, empty months and cancellation',async()=>{
 for(const b of [booking({date:'2024-02-29'}),booking({date:'2024-03-01'}),booking({date:'2026-12-31',status:'cancelled'}),booking({date:'2027-01-01'})])assert.equal((await api.POST(req('POST',b),db)).status,200);
 for(const [month,expected] of [['2024-02','2024-02-29'],['2026-12','2026-12-31'],['2027-01','2027-01-01']]){const r=await api.GET(new Request('https://dpa.example/api/bookings?month='+month),db);assert.deepEqual((await r.json()).bookings.map(b=>b.date),[expected]);}
 assert.deepEqual((await(await api.GET(new Request('https://dpa.example/api/bookings?month=2026-06'),db)).json()).bookings,[]);
});

test('quantities and units preserve legacy prices and calculate rounded line totals',async()=>{
 const value=menu.writeMenu([{name:'Gà',quantity:2,unit:'đĩa',price:240000},{name:'Cá',quantity:0.75,unit:'kg',price:300001}]);
 assert.equal(menu.validMenu(value),true);assert.equal(menu.menuSum(value),705001);assert.ok(menu.menuText(value).includes('2 đĩa'));
 const b=booking({menu:value});assert.equal((await api.POST(req('POST',b),db)).status,200);assert.equal((await(await get()).json()).bookings[0].menu,value);
 for(const patch of [{quantity:0},{quantity:-1},{quantity:1.001},{quantity:1001},{unit:'x'.repeat(31)}])assert.equal(menu.validMenu(menu.writeMenu([{name:'Gà',price:1,...patch}])),false);
 assert.equal(menu.menuSum(menu.writeMenu([{name:'Món cũ',price:240000}])),240000);
});
test('deposits are per reservation and persist across updates with version checks',async()=>{
 const b=booking({tables:['16','17'],price:1200000,deposit:500000});assert.equal((await api.POST(req('POST',b),db)).status,200);
 assert.equal((await(await get()).json()).bookings[0].deposit,500000);
 assert.equal((await api.POST(req('POST',{...b,deposit:800000,version:1}),db)).status,200);
 assert.equal((await(await get()).json()).bookings[0].deposit,800000);
 assert.equal((await api.POST(req('POST',{...b,deposit:700000,version:1}),db)).status,409);
 for(const deposit of [-1,0.5,2400001])assert.equal((await api.POST(req('POST',booking({tables:['18','19'],price:1200000,deposit})),db)).status,400);
 const old=booking({tables:['20']});await api.POST(req('POST',old),db);assert.equal((await(await get()).json()).bookings.find(x=>x.id===old.id).deposit,0);
});
test('catalog starts empty, synchronizes dishes and templates and protects concurrent edits',async()=>{
 const request=(data)=>new Request('https://dpa.example/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 assert.deepEqual(await(await catalogApi.GET_CATALOG(new Request('https://dpa.example/api/catalog'),db)).json(),{dishes:[],templates:[],version:0});
 const value=menu.writeMenu([{name:'Gà mẫu',quantity:2,unit:'đĩa',price:240000}]);
 const initial={version:0,dishes:[{id:crypto.randomUUID(),name:'Gà mẫu',unit:'đĩa',price:240000}],templates:[{id:crypto.randomUUID(),name:'Mâm mẫu',menu:value}]};
 const first=await catalogApi.POST_CATALOG(request(initial),db);assert.equal(first.status,200);const saved=await first.json();assert.equal(saved.version,1);
 assert.equal((await catalogApi.POST_CATALOG(request(initial),db)).status,409);
 assert.equal((await catalogApi.POST_CATALOG(request({...saved,dishes:[{...saved.dishes[0],price:250000}]}),db)).status,200);
 assert.equal((await catalogApi.POST_CATALOG(request({...saved,dishes:[]}),db)).status,409);
 for(const patch of [{dishes:[{...initial.dishes[0],price:-1}]},{dishes:[initial.dishes[0],initial.dishes[0]]},{templates:[{...initial.templates[0],menu:'DPA_MENU_V1:broken'}]},{templates:[{...initial.templates[0],menu:menu.writeMenu([])}]}])assert.equal((await catalogApi.POST_CATALOG(request({...saved,...patch}),db)).status,400);
 const copied=menu.readMenu(saved.templates[0].menu).map(x=>({...x,price:200000}));await api.POST(req('POST',booking({menu:menu.writeMenu(copied)})),db);
 const current=await(await catalogApi.GET_CATALOG(new Request('https://dpa.example/api/catalog'),db)).json();assert.equal(current.dishes[0].price,250000);assert.equal(menu.readMenu(current.templates[0].menu)[0].price,240000);
 const response=await worker.default.fetch(new Request('https://dpa.example/api/catalog',{headers:{Origin:'https://thanson1998.github.io'}}),{DB:db});assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://thanson1998.github.io');
});
test('receipt shows quantities, units, notes, deposit and remaining balance',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const b=booking({tables:['16','17'],price:1200000,deposit:500000,menu:menu.writeMenu([{name:'Gà',quantity:2,unit:'đĩa',price:240000}]),note:'Không cay; ra món lúc 19h'});
 const html=renderToStaticMarkup(React.createElement(printModule.MenuPrintPreview,{booking:b,onClose:()=>{}}));const text=html.replace(/<[^>]*>/g,'');
 for(const expected of ['2 đĩa / bàn','Tổng: 4 đĩa / 2 bàn','Không cay; ra món lúc 19h','Đã cọc','CÒN LẠI'])assert.ok(text.includes(expected),expected);
 for(const amount of [480000,500000,1900000])assert.ok(text.includes(new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(amount)));
});

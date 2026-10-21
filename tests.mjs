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
const source=fs.readFileSync(new URL('./api.ts',import.meta.url),'utf8').replace("'./model'",JSON.stringify(modelUrl)).replace("'zod'",JSON.stringify(pathToFileURL(require.resolve('zod')).href));
const api=await import(dataUrl(compile(source)));
const worker=await import(dataUrl(compile(fs.readFileSync(new URL('./worker.ts',import.meta.url),'utf8').replace("'./api'",JSON.stringify(dataUrl(compile(source)))))));
const printSource=fs.readFileSync(new URL('./print-menu.tsx',import.meta.url),'utf8').replace("'./model'",JSON.stringify(modelUrl)).replace("'react'",JSON.stringify(pathToFileURL(require.resolve('react')).href)).replace("'lucide-react'",JSON.stringify(pathToFileURL(require.resolve('lucide-react')).href));
const printModule=await import(dataUrl(compile(printSource).replace('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href))));
let sqlite,db;
beforeEach(()=>{
 sqlite=new DatabaseSync(':memory:');
 sqlite.exec(fs.readFileSync(new URL('./0001_reservations.sql',import.meta.url),'utf8'));
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

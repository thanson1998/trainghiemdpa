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
const exportSource=fs.readFileSync(new URL('./booking-export.ts',import.meta.url),'utf8').replace("'./model'",JSON.stringify(modelUrl)).replace("'./menu'",JSON.stringify(menuUrl));const bookingExport=await import(dataUrl(compile(exportSource)));
const requestedMenus=JSON.parse(fs.readFileSync(new URL('./menu-templates-20261023.json',import.meta.url),'utf8'));
test('requested menus retain full bundles, different same-price variants and unknown carp price',()=>{
 assert.equal(requestedMenus.length,23);
 for(const template of requestedMenus){assert.ok(menu.validMenu(template.menu),template.name);assert.ok(template.name.length<=100);assert.match(template.id,/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);const set=menu.readMenuSet(template.menu);if(set){assert.equal(set.quantity,1);assert.ok(menu.readMenu(template.menu).every(x=>x.included&&x.price===null&&x.quantity===1));const doubled=menu.setMenuQuantity(template.menu,2,4);assert.equal(menu.menuSum(doubled,4),set.pricePerTable*2);assert.ok(menu.readMenu(doubled,4).every(x=>x.quantity===2));}}
 const samePrice=requestedMenus.filter(t=>t.name.startsWith('Lẩu 8 người – 1,200,000đ'));assert.equal(samePrice.length,2);assert.notEqual(samePrice[0].menu,samePrice[1].menu);
 const carp=requestedMenus.find(t=>t.name.startsWith('Cá chép om dưa'));assert.equal(menu.readMenu(carp.menu)[0].price,null);assert.equal(menu.hasPricedMenu(carp.menu),false);
 assert.equal(menu.readMenu(requestedMenus.find(t=>t.name.startsWith('Set 9 ')).menu).length,13);
 const unspecified=requestedMenus.find(t=>t.name.startsWith('Set 1 '));assert.equal(menu.readMenuSet(unspecified.menu).people,undefined);
 assert.equal(menu.validMenu(menu.writeMenu(menu.readMenu(unspecified.menu),{...menu.readMenuSet(unspecified.menu),people:0})),false);
});
test('requested menu import preserves existing catalog, updates the old hotpot once and is repeatable',()=>{
 const database=new DatabaseSync(':memory:');
 try{database.exec(fs.readFileSync(new URL('./0001_reservations.sql',import.meta.url),'utf8'));database.exec(fs.readFileSync(new URL('./0002_menu_catalog_deposit.sql',import.meta.url),'utf8'));
 const custom={id:'e8742ab8-8a56-4c49-a960-8a82d4a319cf',name:'Mẫu riêng của tôi',menu:'DPA_MENU_V1:[{"name":"Món riêng","price":375000}]'};
 const dish={id:'ab143ea7-e8fb-4145-b509-765cd76df908',name:'Món giá riêng',unit:'bát',price:257000,category:'Nhóm riêng'};
 database.prepare('INSERT INTO menu_catalog(id,data,version,updated_at) VALUES(?,?,?,?)').run('dpa-shared',JSON.stringify({dishes:[dish],templates:[custom]}),9,'before');
 database.exec(fs.readFileSync(new URL('./0004_hotpot_set.sql',import.meta.url),'utf8'));
 const migration=fs.readFileSync(new URL('./0009_menu_templates_20261023.sql',import.meta.url),'utf8');database.exec(migration);
 const result=database.prepare('SELECT * FROM menu_catalog').get(),catalog=JSON.parse(result.data);assert.deepEqual(catalog.dishes,[dish]);assert.deepEqual(catalog.templates[0],custom);assert.equal(catalog.templates.length,24);assert.equal(catalog.templates.filter(t=>t.id==='a877208f-3db9-4778-b41e-47327dd29131').length,1);
 for(const template of requestedMenus)assert.deepEqual(catalog.templates.find(t=>t.id===template.id),template);
 database.exec(migration);assert.deepEqual(database.prepare('SELECT * FROM menu_catalog').get(),result);
 }finally{database.close();}
});
const groupsUrl=dataUrl(compile(fs.readFileSync(new URL('./dish-groups.ts',import.meta.url),'utf8')));const groups=await import(groupsUrl);
const learningSource=fs.readFileSync(new URL('./catalog-learning.ts',import.meta.url),'utf8').replace("'./dish-groups'",JSON.stringify(groupsUrl)).replace("'./menu'",JSON.stringify(menuUrl));
const learningUrl=dataUrl(compile(learningSource));const learning=await import(learningUrl);
const source=fs.readFileSync(new URL('./api.ts',import.meta.url),'utf8').replace("'./catalog-learning'",JSON.stringify(learningUrl)).replace("'./model'",JSON.stringify(modelUrl)).replace("'./menu'",JSON.stringify(menuUrl)).replace("'zod'",JSON.stringify(pathToFileURL(require.resolve('zod')).href));
const api=await import(dataUrl(compile(source)));
const catalogSource=fs.readFileSync(new URL('./catalog-api.ts',import.meta.url),'utf8').replace("'./dish-groups'",JSON.stringify(groupsUrl)).replace("'./menu'",JSON.stringify(menuUrl)).replace("'zod'",JSON.stringify(pathToFileURL(require.resolve('zod')).href));
const catalogApi=await import(dataUrl(compile(catalogSource)));
const importSource=fs.readFileSync(new URL('./text-import.ts',import.meta.url),'utf8').replace("'./model'",JSON.stringify(modelUrl)).replace("'./menu'",JSON.stringify(menuUrl)).replace("'zod'",JSON.stringify(pathToFileURL(require.resolve('zod')).href));
const importUrl=dataUrl(compile(importSource));const textImport=await import(importUrl);
const paymentsUrl=dataUrl(compile(fs.readFileSync(new URL('./payments-api.ts',import.meta.url),'utf8').replace("'zod'",JSON.stringify(pathToFileURL(require.resolve('zod')).href))));const paymentsApi=await import(paymentsUrl);
const worker=await import(dataUrl(compile(fs.readFileSync(new URL('./worker.ts',import.meta.url),'utf8').replace("'./payments-api'",JSON.stringify(paymentsUrl)).replace("'./text-import'",JSON.stringify(importUrl)).replace("'./api'",JSON.stringify(dataUrl(compile(source)))).replace("'./catalog-api'",JSON.stringify(dataUrl(compile(catalogSource)))))));
const kitchenUrl=dataUrl(compile(fs.readFileSync(new URL('./kitchen-delta.ts',import.meta.url),'utf8').replace("'./menu'",JSON.stringify(menuUrl))));const kitchen=await import(kitchenUrl);
const bookingLogicUrl=dataUrl(compile(fs.readFileSync(new URL('./booking-logic.ts',import.meta.url),'utf8').replace("'./menu'",JSON.stringify(menuUrl))));const bookingLogic=await import(bookingLogicUrl);
const posLogicUrl=dataUrl(compile(fs.readFileSync(new URL('./pos-logic.ts',import.meta.url),'utf8').replace("'./model'",JSON.stringify(modelUrl)).replace("'./menu'",JSON.stringify(menuUrl)).replace("'./booking-logic'",JSON.stringify(bookingLogicUrl))));const posLogic=await import(posLogicUrl);
const cardsSource=fs.readFileSync(new URL('./booking-cards.tsx',import.meta.url),'utf8').replace("'./model'",JSON.stringify(modelUrl));const cardsUrl=dataUrl(compile(cardsSource).replace('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href)));
const printSource=fs.readFileSync(new URL('./print-menu.tsx',import.meta.url),'utf8').replace("'./sync'",JSON.stringify(dataUrl('export async function apiRequest(){throw new Error("not used during SSR");}'))).replace("'./kitchen-delta'",JSON.stringify(kitchenUrl)).replace("'./model'",JSON.stringify(modelUrl)).replace("'./menu'",JSON.stringify(menuUrl)).replace("'react'",JSON.stringify(pathToFileURL(require.resolve('react')).href)).replace("'lucide-react'",JSON.stringify(pathToFileURL(require.resolve('lucide-react')).href)).replace("'html2canvas'",JSON.stringify(pathToFileURL(require.resolve('html2canvas')).href));
const printModule=await import(dataUrl(compile(printSource).replace('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href))));
const checkoutBillSource=fs.readFileSync(new URL('./checkout-bill.tsx',import.meta.url),'utf8').replace("'./model'",JSON.stringify(modelUrl)).replace("'./menu'",JSON.stringify(menuUrl)).replace("'react'",JSON.stringify(pathToFileURL(require.resolve('react')).href)).replace("'react-dom'",JSON.stringify(pathToFileURL(require.resolve('react-dom')).href));
const checkoutBillModule=await import(dataUrl(compile(checkoutBillSource).replace('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href))));
let sqlite,db;
beforeEach(()=>{
 sqlite=new DatabaseSync(':memory:');
 sqlite.exec(fs.readFileSync(new URL('./0001_reservations.sql',import.meta.url),'utf8'));
 sqlite.exec(fs.readFileSync(new URL('./0002_menu_catalog_deposit.sql',import.meta.url),'utf8'));
 sqlite.exec(fs.readFileSync(new URL('./0003_order_codes.sql',import.meta.url),'utf8'));
 sqlite.exec(fs.readFileSync(new URL('./0006_booking_workflow.sql',import.meta.url),'utf8'));
 sqlite.exec(fs.readFileSync(new URL('./0007_payments.sql',import.meta.url),'utf8'));
 sqlite.exec(fs.readFileSync(new URL('./0010_payment_reversals.sql',import.meta.url),'utf8'));

 db={prepare(sql){const statement=sqlite.prepare(sql);const bound=(values=[])=>({bind(...args){return bound(args)},async all(){return{results:statement.all(...values)}},async run(){return{meta:{changes:statement.run(...values).changes}}}});return bound();},async batch(statements){sqlite.exec('BEGIN');try{const results=await Promise.all(statements.map(s=>s.all()));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
});
afterEach(()=>sqlite.close());
const booking=(extra={})=>({id:crypto.randomUUID(),date:'2026-10-25',start:'11:00',end:'14:00',name:'Chị Hương',phone:'0900000000',tables:['S1-01'],people:10,platters:1,price:1500000,menu:'Gà hấp\nLẩu cá tầm',note:'',status:'reserved',version:0,...extra});
const req=(method,data)=>new Request('https://dpa.example/api/bookings',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const get=()=>api.GET(new Request('https://dpa.example/api/bookings?date=2026-10-25'),db);

test('checkout bill shows dishes, units and set quantities while retaining agreed total, deposit and unpaid balance',()=>{
 const b=booking({orderCode:'DPA-25102026-01',tables:['S1-01','S1-02'],people:7,totalPeople:13,price:1250000,deposit:500000,note:'Ra món lúc 18:30',menu:menu.writeMenu([{name:'Gà trong set',quantity:2,unit:'đĩa',price:null,included:true},{name:'Bia',quantity:3,unit:'chai',price:20000}],{name:'Set lẩu',quantity:2,people:6,pricePerTable:1200000})});
 const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(checkoutBillModule.CheckoutBill,{booking:b})),text=html.replace(/<[^>]*>/g,'');
 for(const expected of ['DPA-25102026-01','S1-01, S1-02','13 người','Gà trong set','Bia','chai','đĩa','Đơn giá','Tổng','2,500,000','500,000','2,000,000','2,460,000','60,000','Trong set','Ra món lúc 18:30','Chưa xác nhận thanh toán'])assert.ok(text.includes(expected),expected);
 assert.match(html,/<b>2<\/b> đĩa/);assert.match(html,/<b>3<\/b> chai/);assert.ok(!text.includes('4 đĩa'));
});

test('dish group migration classifies Vietnamese names while preserving manual groups, prices, units and templates',async()=>{
 const names=['NƯỚC ÉP - LỰU','Trà quất sả','Rượu nếp','Bia Hà Nội','Cà phê sữa đá','Gà hấp bia','Bò sốt vang','Mận ngâm','Sinh tố xoài','Hướng dương','Cơm rang'];
 const dishes=names.map((name,i)=>({id:crypto.randomUUID(),name,unit:i%2?'chai':'đĩa',price:30000+i}));dishes.push({id:crypto.randomUUID(),name:'Món riêng',unit:'bát',price:70000,category:'Nhóm tự đặt'});
 const template={id:crypto.randomUUID(),name:'Set giữ nguyên',menu:menu.writeMenu([{name:'Gà',quantity:2,price:200000}])};
 sqlite.prepare('INSERT INTO menu_catalog(id,data,version,updated_at) VALUES(?,?,?,?)').run('dpa-shared',JSON.stringify({dishes,templates:[template]}),5,'2026-10-23T00:00:00Z');
 const migration=fs.readFileSync(new URL('./0008_dish_groups.sql',import.meta.url),'utf8');sqlite.exec(migration);
 const raw=sqlite.prepare('SELECT * FROM menu_catalog').get(),data=JSON.parse(raw.data);assert.equal(raw.version,6);assert.deepEqual(data.templates,[template]);
 for(let i=0;i<dishes.length;i++){const {category,...rest}=data.dishes[i];const {category:oldCategory,...original}=dishes[i];assert.deepEqual(rest,original);assert.equal(category,oldCategory||groups.inferDishGroup(original.name));}
 assert.deepEqual(data.dishes.slice(0,5).map(d=>d.category),['Nước ép','Trà','Rượu','Bia','Cà phê']);assert.equal(data.dishes[5].category,'Món ăn');assert.equal(data.dishes[6].category,'Món ăn');
 sqlite.exec(migration);assert.equal(sqlite.prepare('SELECT version FROM menu_catalog').get().version,6);
});
test('dish groups can be edited, synchronized and kept when old clients only update prices',async()=>{
 const dish={id:crypto.randomUUID(),name:'Trà quất sả',unit:'cốc',price:30000};let r=await catalogApi.POST_CATALOG(req('POST',{version:0,dishes:[dish],templates:[]}),db);let c=await r.json();assert.equal(c.dishes[0].category,'Trà');
 r=await catalogApi.POST_CATALOG(req('POST',{...c,dishes:[{...c.dishes[0],category:'Đồ uống đặc biệt'}]}),db);c=await r.json();assert.equal(c.dishes[0].category,'Đồ uống đặc biệt');
 const {category,...legacy}=c.dishes[0];r=await catalogApi.POST_CATALOG(req('POST',{...c,dishes:[{...legacy,price:35000}]}),db);c=await r.json();assert.equal(c.dishes[0].category,'Đồ uống đặc biệt');assert.equal(c.dishes[0].price,35000);
 r=await catalogApi.POST_CATALOG(req('POST',{...c,dishes:[{...c.dishes[0],category:''}]}),db);c=await r.json();assert.equal(c.dishes[0].category,'Trà');
 const read=await(await catalogApi.GET_CATALOG(req('GET'),db)).json();assert.equal(read.dishes[0].category,'Trà');assert.equal(read.dishes[0].price,35000);
 const merged=learning.mergeLearnedDishes(read,menu.writeMenu([{name:'Nước ép cóc',price:30000,unit:'cốc'}]),['Nước ép cóc']);assert.equal(merged.catalog.dishes.at(-1).category,'Nước ép');
});

test('POS combines repeated dishes, preserves edited prices and expands legacy sets exactly once',()=>{
 const original=booking({tables:['S1-01','S1-02'],priceMode:'auto',menu:menu.writeMenu([{name:'Gà',price:300000,quantity:1,unit:'đĩa'}])});
 const added=posLogic.posAppend(original,[{name:' gà ',price:350000,quantity:1,unit:'phần'}]);assert.equal(menu.readMenu(added.menu).length,1);assert.equal(menu.readMenu(added.menu)[0].price,300000);assert.equal(menu.readMenu(added.menu)[0].quantity,2);assert.equal(added.price,300000);
 const agreed={...added,priceMode:'agreed',price:1000000};assert.equal(posLogic.posAppend(agreed,[{name:'Tôm',quantity:1,price:200000}]).price,1000000);
 const legacy=booking({tables:['S1-01','S1-02'],priceMode:'auto',menu:menu.writeMenu([{name:'Trong set',quantity:1,price:null,included:true}],{name:'Lẩu',people:6,pricePerTable:1200000})});
 const next=posLogic.posAppend(legacy,[{name:'Bia',quantity:3,unit:'chai',price:20000}]);assert.equal(menu.readMenu(next.menu,2)[0].quantity,2);assert.equal(menu.readMenuSet(next.menu).quantity,2);assert.equal(menu.menuSum(next.menu,2),2460000);assert.equal(next.price,1230000);
 const edited=posLogic.posEditItem(next,1,{quantity:4});assert.equal(menu.readMenu(edited.menu,2)[0].quantity,2);assert.equal(menu.menuSum(edited.menu,2),2480000);
 assert.throws(()=>posLogic.posAppend(legacy,[{name:'Trong set',price:300000,quantity:1}]),/ngoài giá set/);
});
test('POS saves one shared order and settled tables can immediately serve a new party',async()=>{
 let b=posLogic.newPosBooking('2026-10-25');assert.equal(posLogic.posIssue(b),'Chọn ít nhất một bàn trước khi lưu.');b={...b,tables:['S1-01'],start:'18:00',end:'21:00'};
 b=posLogic.posAppend(b,[{name:'Gà',price:300000,quantity:2,unit:'đĩa'}]);assert.equal(posLogic.posIssue(b),'');assert.equal((await api.POST(req('POST',b),db)).status,200);const current=(await(await get()).json()).bookings[0];assert.match(current.orderCode,/^DPA-25102026-/);assert.equal(current.price,600000);
 assert.equal((await api.POST(req('POST',b),db)).status,409);assert.equal((await(await get()).json()).bookings.length,1);
 const other={...b,id:crypto.randomUUID()};assert.equal((await api.POST(req('POST',other),db)).status,409);
 assert.equal((await paymentsApi.PAY(req('POST',{id:b.id,version:1,total:600000,deposit:0,tendered:600000,method:'cash'}),db)).status,200);
 assert.equal((await api.POST(req('POST',other),db)).status,200);assert.equal((await(await get()).json()).bookings.length,2);
});
test('POS keeps recoverable draft tabs and identifies missing prices and invalid time',()=>{
 const b=booking({menu:menu.writeMenu([{name:'Món mới',price:null}]),priceMode:'auto'});assert.ok(posLogic.posIssue(b).includes('Nhập đủ giá'));assert.equal(posLogic.posIssue({...b,priceMode:'agreed'}),'');assert.ok(posLogic.posIssue({...b,start:'8:0'}).includes('24h'));
 const t={booking:b,saved:posLogic.posFingerprint(b)};assert.equal(posLogic.posDirty(t),false);assert.equal(posLogic.posDirty({...t,booking:{...b,name:'Thay đổi'}}),true);
 const recovered=posLogic.readPosTickets(JSON.stringify({format:'DPA_POS_V1',tickets:[t],selected:b.id}));assert.equal(recovered.selected,b.id);assert.equal(recovered.tickets[0].booking.menu,b.menu);assert.equal(posLogic.readPosTickets('not JSON'),null);
});
test('POS opens orders beyond ten tabs, preserves dirty drafts and refreshes clean tickets without duplicates',()=>{
 const tickets=Array.from({length:10},()=>{const b=booking();return {booking:b,saved:posLogic.posFingerprint(b)};});
 const requested=booking({version:2,name:'Đơn cần mở',tables:['8','9']});let state=posLogic.openPosTicket({tickets,selected:tickets[0].booking.id},requested);assert.equal(state.selected,requested.id);assert.equal(state.tickets.length,11);assert.equal(state.tickets.at(-1).booking.name,'Đơn cần mở');
 state=posLogic.openPosTicket(state,requested);assert.equal(state.tickets.length,11);
 const edited={...requested,name:'Nháp chưa lưu',menu:menu.writeMenu([{name:'Món đang nhập',price:50000}])};state={...state,tickets:state.tickets.map(t=>t.booking.id===requested.id?{...t,booking:edited}:t)};
 state=posLogic.openPosTicket(state,{...requested,version:3,name:'Bản máy chủ'});assert.equal(state.tickets.at(-1).booking.name,'Nháp chưa lưu');assert.equal(state.tickets.at(-1).booking.version,2);
 const clean={...state,tickets:state.tickets.map(t=>t.booking.id===requested.id?{booking:requested,saved:posLogic.posFingerprint(requested)}:t)};const refreshed=posLogic.openPosTicket(clean,{...requested,version:3,name:'Bản mới'});assert.equal(refreshed.tickets.at(-1).booking.version,3);assert.equal(refreshed.tickets.at(-1).booking.name,'Bản mới');assert.equal(posLogic.posDirty(refreshed.tickets.at(-1)),false);
 const recovered=posLogic.readPosTickets(JSON.stringify({format:'DPA_POS_V1',...refreshed}));assert.equal(recovered.tickets.length,11);assert.equal(recovered.selected,requested.id);
});

test('payment records exact agreed total minus deposit, change and a completed audit entry once',async()=>{
 const original=booking({tables:['S1-01','S1-02'],price:1250000,deposit:500000,totalPeople:13});await api.POST(req('POST',original),db);
 const current=(await(await get()).json()).bookings[0];const body={id:current.id,version:current.version,total:2500000,deposit:500000,tendered:2100000,method:'cash'};
 const r=await paymentsApi.PAY(req('POST',body),db),j=await r.json();assert.equal(r.status,200);assert.equal(j.payment.received,2000000);assert.equal(j.payment.tendered-j.payment.received,100000);assert.equal(j.payment.booking.totalPeople,13);
 const saved=(await(await get()).json()).bookings[0];assert.equal(saved.status,'completed');assert.equal(saved.version,2);assert.ok(saved.paidAt);assert.equal(saved.price,1250000);
 assert.equal((await import(modelUrl)).balanceDue(saved),0);
 assert.equal((await paymentsApi.PAY(req('POST',{...body,version:2}),db)).status,409);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM booking_payments').get().n,1);assert.equal((await(await get()).json()).bookings[0].version,2);
 const history=(await(await api.HISTORY(req('GET'),db)).json()).history;assert.equal(history[0].booking.status,'completed');assert.equal(history[0].version,2);
 const backup=await(await api.BACKUP(req('GET'),db)).json();assert.equal(backup.payments.length,1);
 const list=await paymentsApi.GET_PAYMENTS(new Request('https://dpa.example/api/payments?month=2026-10'),db);assert.equal((await list.json()).payments[0].total,2500000);
});
test('payment rejects stale totals, missing cash, excess transfer and cancelled bookings without saving',async()=>{
 const original=booking({deposit:500000});await api.POST(req('POST',original),db);const current=(await(await get()).json()).bookings[0];const body={id:current.id,version:1,total:1500000,deposit:500000,tendered:1000000,method:'transfer'};
 for(const patch of [{version:2},{total:1400000},{deposit:0}])assert.equal((await paymentsApi.PAY(req('POST',{...body,...patch}),db)).status,409);
 for(const patch of [{tendered:999999},{tendered:1100000},{method:'card'},{tendered:-1}])assert.equal((await paymentsApi.PAY(req('POST',{...body,...patch}),db)).status,400);
 await api.POST(req('POST',{...current,status:'cancelled'}),db);assert.equal((await paymentsApi.PAY(req('POST',{...body,version:2}),db)).status,409);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM booking_payments').get().n,0);
});
test('settled orders reject booking edits, deletion, table moves and history restore',async()=>{
 const original=booking({deposit:1500000});await api.POST(req('POST',original),db);const before=(await(await get()).json()).bookings[0];const entry=(await(await api.HISTORY(req('GET'),db)).json()).history[0];
 assert.equal((await paymentsApi.PAY(req('POST',{id:before.id,version:1,total:1500000,deposit:1500000,tendered:0,method:'transfer'}),db)).status,200);const current=(await(await get()).json()).bookings[0];
 assert.equal((await api.POST(req('POST',{...current,price:2000000}),db)).status,409);assert.equal((await api.DELETE(req('DELETE',{id:current.id,version:2}),db)).status,409);assert.equal((await api.MOVE(req('POST',{id:current.id,version:2,tables:['S1-02']}),db)).status,409);assert.equal((await api.RESTORE(req('POST',{id:entry.id,expectedVersion:2}),db)).status,409);
 assert.throws(()=>sqlite.prepare('UPDATE reservations SET price=1 WHERE id=?').run(current.id),/PAYMENT_LOCKED/);assert.throws(()=>sqlite.prepare('DELETE FROM reservations WHERE id=?').run(current.id),/PAYMENT_LOCKED/);
 const saved=(await(await get()).json()).bookings[0];assert.equal(saved.price,1500000);assert.equal(saved.version,2);
});
test('payment route follows CORS and JSON rules and leaves old completed orders unpaid',async()=>{
 const original=booking({status:'completed'});await api.POST(req('POST',original),db);assert.equal((await(await get()).json()).bookings[0].paidAt,undefined);
 const env={DB:db,ASSETS:{}};const url='https://worker.example/api/payments?month=2026-10';const r=await worker.default.fetch(new Request(url,{headers:{Origin:'https://thanson1998.github.io'}}),env);assert.equal(r.status,200);assert.equal((await r.json()).payments.length,0);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://thanson1998.github.io');
 assert.equal((await worker.default.fetch(new Request(url,{headers:{Origin:'https://unknown.example'}}),env)).status,403);assert.equal((await worker.default.fetch(new Request(url,{method:'POST',body:'bad'}),env)).status,415);assert.equal((await paymentsApi.GET_PAYMENTS(new Request('https://dpa.example/api/payments?month=bad'),db)).status,400);
});

test('Gemini accepts older REST schema formats without leaking provider details or changing user text',async()=>{
 let calls=0;const text='Gà hấp 2 đĩa, mỗi đĩa 320k';
 const result=await textImport.extractWithGemini(text,{DB:db,GEMINI_API_KEY:'TEST_ONLY_NOT_A_REAL_KEY'},async(url,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(body.contents[0].parts[0].text,text);if(calls===1)return Response.json({error:{message:'Unknown name "responseFormat" at generationConfig'}},{status:400});assert.equal(body.generationConfig.responseMimeType,'application/json');assert.ok(!body.generationConfig.responseFormat);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({items:[{name:'Gà hấp',quantity:2,price:320000}]})}]}}]});});
 assert.equal(calls,2);assert.equal(textImport.normalizeImport(textImport.decodeImportResponse(result.response)).total,640000);
});

test('agreed prices survive menu and table edits, automatic prices change only in automatic mode',()=>{
 const original=booking({price:1500000,priceMode:'agreed',totalPeople:13,menu:menu.writeMenu([{name:'Gà',quantity:2,price:320000}])});
 const edited=bookingLogic.updateBookingDraft(original,'tables',['S1-01','S1-02']);assert.equal(edited.price,1500000);assert.equal(edited.totalPeople,13);assert.equal(edited.people,7);
 const auto=bookingLogic.updateBookingDraft(edited,'priceMode','auto');assert.equal(auto.price,320000);
 const locked=bookingLogic.updateBookingDraft(auto,'price',500000);assert.equal(locked.priceMode,'agreed');assert.equal(bookingLogic.updateBookingDraft(locked,'menu',menu.writeMenu([{name:'New',price:1}])).price,500000);
});
test('odd total guest counts persist and print accurately while legacy guest counts remain readable',async()=>{
 const b=booking({tables:['S1-01','S1-02'],people:7,totalPeople:13,priceMode:'agreed'});assert.equal((await api.POST(req('POST',b),db)).status,200);
 const saved=(await(await get()).json()).bookings[0];assert.equal(saved.totalPeople,13);assert.equal(saved.priceMode,'agreed');
 const model=await import(modelUrl);assert.equal(model.guestCount(saved),13);assert.equal(model.guestCount(booking({tables:['S1-01','S1-02'],people:6})),12);
 const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(printModule.MenuPrintPreview,{booking:saved,onClose(){}}));assert.ok(html.includes('13'));assert.ok(!html.includes('14 người'));assert.ok(!html.includes('7 người / bàn'));
 const imported=textImport.normalizeImport({totalPeople:13,tables:['S1-01','S1-02']});assert.equal(imported.fields.totalPeople,13);assert.equal(imported.fields.people,7);
});
test('history restores deleted bookings with higher versions and rejects stale clients',async()=>{
 const original=booking();await api.POST(req('POST',original),db);let current=(await(await get()).json()).bookings[0];const oldCode=current.orderCode;
 await api.POST(req('POST',{...current,name:'Edited'}),db);current=(await(await get()).json()).bookings[0];assert.equal((await api.DELETE(req('DELETE',{id:original.id,version:2}),db)).status,200);
 const entries=(await(await api.HISTORY(req('GET'),db)).json()).history;assert.equal(entries.filter(e=>e.action==='created').length,1);assert.equal(entries[0].action,'deleted');
 assert.equal((await api.RESTORE(req('POST',{id:entries[0].id,expectedVersion:0}),db)).status,200);
 const restored=(await(await get()).json()).bookings[0];assert.equal(restored.id,original.id);assert.equal(restored.name,'Edited');assert.equal(restored.version,3);assert.notEqual(restored.orderCode,oldCode);
 assert.equal((await api.POST(req('POST',{...restored,version:1,name:'Stale'}),db)).status,409);assert.equal((await api.POST(req('POST',{...restored,version:2,name:'Stale'}),db)).status,409);
});
test('history restore checks current versions and overlapping tables',async()=>{
 const original=booking();await api.POST(req('POST',original),db);const created=(await(await api.HISTORY(req('GET'),db)).json()).history[0];
 let current=(await(await get()).json()).bookings[0];await api.POST(req('POST',{...current,name:'Changed',totalPeople:13}),db);
 assert.equal((await api.RESTORE(req('POST',{id:created.id,expectedVersion:1}),db)).status,409);
 assert.equal((await api.RESTORE(req('POST',{id:created.id,expectedVersion:2}),db)).status,200);current=(await(await get()).json()).bookings[0];assert.equal(current.name,original.name);assert.equal(current.totalPeople,undefined);
 await api.DELETE(req('DELETE',{id:current.id,version:current.version}),db);await api.POST(req('POST',booking()),db);
 assert.equal((await api.RESTORE(req('POST',{id:created.id,expectedVersion:0}),db)).status,409);assert.equal((await(await get()).json()).bookings.length,1);
});

test('workflow migration preserves existing booking codes, prices, menus, guests and deposits',()=>{
 const legacy=new DatabaseSync(':memory:');try{
  for(const file of ['0001_reservations.sql','0002_menu_catalog_deposit.sql','0003_order_codes.sql'])legacy.exec(fs.readFileSync(new URL('./'+file,import.meta.url),'utf8'));
  const b=booking({people:6,price:1555000,deposit:500000,menu:menu.writeMenu([{name:'Original price',quantity:2,price:400000}])});
  legacy.prepare('INSERT INTO reservations(id,user_id,date,start,end,name,phone,table_ids,people,platters,price,deposit,menu,note,status,version,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(b.id,'dpa-shared',b.date,b.start,b.end,b.name,b.phone,JSON.stringify(b.tables),b.people,b.platters,b.price,b.deposit,b.menu,b.note,b.status,1,new Date().toISOString());
  const before=legacy.prepare('SELECT * FROM reservations').get();legacy.exec(fs.readFileSync(new URL('./0006_booking_workflow.sql',import.meta.url),'utf8'));const after=legacy.prepare('SELECT * FROM reservations').get();
  const {total_people,price_mode,...unchanged}=after;assert.deepEqual(unchanged,{...before});assert.equal(total_people,null);assert.equal(price_mode,'agreed');const baseline=JSON.parse(legacy.prepare('SELECT snapshot FROM reservation_history').get().snapshot);assert.equal(baseline.price,b.price);assert.equal(baseline.orderCode,before.order_code);assert.equal(baseline.menu,b.menu);
 }finally{legacy.close();}
});
test('kitchen confirmation rejects unsaved changes and retains the last confirmed menu',async()=>{
 const original=booking({menu:menu.writeMenu([{name:'Gà',quantity:2,price:300000}])});await api.POST(req('POST',original),db);let current=(await(await get()).json()).bookings[0];
 const read=()=>api.GET_PRINT(new Request('https://dpa.example/api/bookings/prints?id='+original.id),db);
 assert.equal((await(await read()).json()).last,null);
 assert.equal((await api.CONFIRM_PRINT(req('POST',{booking:{...current,menu:menu.writeMenu([{name:'Gà',quantity:3,price:300000}])}}),db)).status,409);
 assert.equal((await api.CONFIRM_PRINT(req('POST',{booking:current}),db)).status,200);const first=(await(await read()).json()).last;assert.equal(first.menu,current.menu);
 await api.POST(req('POST',{...current,menu:menu.writeMenu([{name:'Gà',quantity:3,price:300000}])}),db);current=(await(await get()).json()).bookings[0];assert.equal((await(await read()).json()).last.menu,first.menu);
 assert.equal((await api.CONFIRM_PRINT(req('POST',{booking:current}),db)).status,200);assert.equal((await(await read()).json()).last.version,2);
});
test('kitchen delta prints added and removed quantities once including resized sets',()=>{
 const first=booking({menu:menu.writeMenu([{name:'Gà',quantity:2,price:300000},{name:'Tôm',quantity:2,price:200000}])});
 const next={...first,tables:['S1-02'],menu:menu.writeMenu([{name:'Gà',quantity:3,price:320000}])};const diff=kitchen.kitchenDelta(first,next);
 assert.equal(diff.added[0].quantity,1);assert.equal(diff.removed[0].quantity,2);assert.ok(diff.notes.some(n=>n.includes('Chuyển bàn')));assert.ok(diff.notes.some(n=>n.includes('Đổi đơn giá')));assert.equal(kitchen.kitchenDelta(first,first).changed,false);
 const set=menu.writeMenu([{name:'Gà trong set',quantity:2,price:null,included:true}],{name:'Set',quantity:2,pricePerTable:1200000,people:6});const setBooking=booking({tables:['S1-01','S1-02'],menu:set});const resized={...setBooking,menu:menu.setMenuQuantity(set,3)};assert.equal(kitchen.kitchenDelta(setBooking,resized).added[0].quantity,1);
});
test('backup contains bookings, menu library, audit history and confirmed prints in one snapshot',async()=>{
 const original=booking();await api.POST(req('POST',original),db);const current=(await(await get()).json()).bookings[0];await api.CONFIRM_PRINT(req('POST',{booking:current}),db);
 const r=await api.BACKUP(req('GET'),db),data=await r.json();assert.equal(r.status,200);assert.equal(data.format,'DPA_BACKUP_V1');assert.equal(data.bookings.length,1);assert.ok(data.history.length);assert.equal(data.prints.length,1);assert.ok(Array.isArray(data.catalog));assert.equal((await(await get()).json()).bookings[0].version,1);
});
test('AI status reveals the configured provider without exposing its key and real-check does not save data',async()=>{
 const secret='TEST_ONLY_STATUS_KEY';const env={DB:db,ASSETS:{},GEMINI_API_KEY:secret};
 const status=await worker.default.fetch(new Request('https://worker.example/api/ai-status'),env);const state=await status.json();assert.equal(state.provider,'gemini');assert.equal(state.configured,true);assert.ok(!JSON.stringify(state).includes(secret));
 const checkEnv={DB:db,ASSETS:{},AI:{async run(){return{response:JSON.stringify({name:'Test',date:'2026-10-25',start:'18:00',end:'21:00',tables:['S1-07'],totalPeople:6,items:[{name:'Gà',quantity:2,price:320000}]})};}}};
 const check=await worker.default.fetch(new Request('https://worker.example/api/ai-check',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),checkEnv);assert.equal(check.status,200);assert.equal((await check.json()).provider,'cloudflare');assert.equal((await(await get()).json()).bookings.length,0);
});

test('Gemini sends the key only as a server header and requests a structured booking',async()=>{
 let url,options;const fakeKey='TEST_ONLY_NOT_A_REAL_KEY';
 const response=await textImport.extractWithGemini('Gà hấp 2 đĩa 320k/đĩa',{DB:db,GEMINI_API_KEY:fakeKey},async(u,o)=>{url=String(u);options=o;return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'Do not parse thoughts'},{text:JSON.stringify({name:'Test',tables:['S1-07'],items:[{name:'Gà hấp',price:320000,quantity:2}]})}]}}]});});
 assert.ok(url.includes('gemini-3.1-flash-lite:generateContent'));assert.ok(!url.includes(fakeKey));assert.ok(!options.body.includes(fakeKey));assert.equal(options.headers['x-goog-api-key'],fakeKey);assert.equal(JSON.parse(options.body).generationConfig.responseFormat.text.mimeType,'APPLICATION_JSON');assert.equal(textImport.normalizeImport(textImport.decodeImportResponse(response.response)).total,640000);
});
test('configured Gemini takes priority and a rejected key never silently sends data to Cloudflare',async()=>{
 sqlite.exec(fs.readFileSync(new URL('./0005_text_import_usage.sql',import.meta.url),'utf8'));
 const previous=globalThis.fetch;let cloudflareCalls=0;const env={DB:db,GEMINI_API_KEY:'TEST_ONLY_NOT_A_REAL_KEY',AI:{async run(){cloudflareCalls++;throw Error('Must not call Cloudflare');}}};
 try{
  globalThis.fetch=async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({tables:['S1-07'],totalPeople:6,items:[{name:'Gà hấp',quantity:2,price:320000}]})}]}}]});
  const response=await textImport.IMPORT(req('POST',{text:'Gà hấp 2 đĩa 320k/đĩa'}),env);const data=await response.json();assert.equal(response.status,200);assert.equal(data.provider,'gemini');assert.equal(data.fields.price,640000);assert.ok(!JSON.stringify(data).includes(env.GEMINI_API_KEY));
  globalThis.fetch=async()=>Response.json({error:{message:'Sensitive provider details'}},{status:403});
  const denied=await textImport.IMPORT(req('POST',{text:'Gà hấp'}),env);const failure=await denied.json();assert.equal(failure.code,'GEMINI_ACCESS_DENIED');assert.ok(!JSON.stringify(failure).includes('Sensitive provider details'));assert.equal(cloudflareCalls,0);
 }finally{globalThis.fetch=previous;}
});

test('JSON-mode failure retries generation while keeping validation and explicit prices',async()=>{
 sqlite.exec(fs.readFileSync(new URL('./0005_text_import_usage.sql',import.meta.url),'utf8'));
 let calls=0;const AI={async run(model,input){calls++;if(input.response_format)throw new Error('JSON Mode could not be met');return{response:JSON.stringify({tables:['S1-07'],totalPeople:6,items:[{name:'Gà hấp',quantity:2,price:320000}]})};}};
 const response=await textImport.IMPORT(req('POST',{text:'Gà hấp 2 đĩa 320k/đĩa, 6 người bàn S1-07'}),{DB:db,AI});assert.equal(response.status,200);assert.equal(calls,2);assert.equal((await response.json()).fields.price,640000);
});

test('AI uses an available FP8 model with a defined JSON schema and accepts wrapped JSON',async()=>{
 sqlite.exec(fs.readFileSync(new URL('./0005_text_import_usage.sql',import.meta.url),'utf8'));
 let model,input;const AI={async run(m,i){model=m;input=i;return{response:'```json\n'+JSON.stringify({name:'Test',tables:null,warnings:null,items:[{name:'Gà hấp',price:320000,quantity:2}]})+'\n```'};}};
 const response=await textImport.IMPORT(req('POST',{text:'Anh Sơn lấy gà hấp 2 đĩa 320k/đĩa'}),{DB:db,AI});assert.equal(response.status,200);assert.equal(model,'@cf/meta/llama-3.1-8b-instruct-fp8');assert.equal(input.response_format.type,'json_schema');assert.ok(input.response_format.json_schema.properties.items);assert.equal((await response.json()).total,640000);
 assert.throws(()=>textImport.decodeImportResponse('invalid JSON'));assert.throws(()=>textImport.decodeImportResponse([]));
});
test('provider failures identify configuration and quota errors without blaming user input or leaking content',async()=>{
 sqlite.exec(fs.readFileSync(new URL('./0005_text_import_usage.sql',import.meta.url),'utf8'));
 const AI={async run(){throw new Error('5007 No such model: private diagnostic');}};
 const response=await textImport.IMPORT(req('POST',{text:'Nội dung khách'}),{DB:db,AI});const data=await response.json();assert.equal(data.code,'AI_MODEL_UNAVAILABLE');assert.ok(!data.error.includes('private diagnostic'));assert.ok(!data.error.includes('Nội dung khách'));
 assert.equal(textImport.importFailure('ai',new Error('3036 daily allocation exceeded')).code,'AI_DAILY_LIMIT');assert.equal(textImport.importFailure('ai',new Error('JSON Mode could not be met')).code,'AI_RESPONSE_FORMAT');assert.equal(textImport.importFailure('storage',new Error('missing table')).code,'IMPORT_STORAGE');
});

test('AI booking save adds new dishes and updates explicit prices while preserving templates and prior bookings',async()=>{
 const id=crypto.randomUUID(),template={id:crypto.randomUUID(),name:'Existing template',menu:menu.writeMenu([{name:'Existing',price:100000}])};
 await catalogApi.POST_CATALOG(req('POST',{version:0,dishes:[{id,name:'Gà hấp',unit:'đĩa',price:300000}],templates:[template]}),db);
 const old=booking({price:300000,menu:menu.writeMenu([{name:'Gà hấp',price:300000,quantity:1}])});await api.POST(req('POST',old),db);
 const next=booking({tables:['S1-02'],price:740000,menu:menu.writeMenu([{name:'Gà hấp',unit:'đĩa',price:320000,quantity:2},{name:'Món mới',unit:'bát',price:100000,quantity:1}]),learnDishNames:['Gà hấp','Món mới']});
 assert.equal((await api.POST(req('POST',next),db)).status,200);
 const catalog=(await(await catalogApi.GET_CATALOG(req('GET'),db)).json());assert.equal(catalog.dishes.length,2);assert.equal(catalog.dishes[0].id,id);assert.equal(catalog.dishes[0].price,320000);assert.equal(catalog.dishes[1].price,100000);assert.equal(catalog.dishes[1].unit,'bát');assert.deepEqual(catalog.templates,[template]);
 const bookings=(await(await get()).json()).bookings;assert.equal(bookings.find(b=>b.id===old.id).price,300000);assert.equal(menu.readMenu(bookings.find(b=>b.id===old.id).menu)[0].price,300000);
 assert.equal(await learning.learnCatalogFromMenu(db,next.menu,next.learnDishNames),'');const repeated=await(await catalogApi.GET_CATALOG(req('GET'),db)).json();assert.equal(repeated.version,catalog.version);assert.equal(repeated.dishes.length,2);
});
test('reading a draft never changes catalog and only stated prices are selected for learning',async()=>{
 const dishes=[{name:'Gà hấp',unit:'đĩa',price:300000},{name:'Tôm hấp',unit:'đĩa',price:250000}];
 const result=textImport.normalizeImport({items:[{name:'ga hap',quantity:2,price:320000},{name:'Tôm hấp',quantity:2},{name:'Món mới',quantity:1,price:100000}]},{dishes});
 assert.deepEqual(result.learnDishNames,['Gà hấp','Món mới']);
 const catalog={version:1,dishes:dishes.map(d=>({...d,id:crypto.randomUUID()})),templates:[]};
 const merged=learning.mergeLearnedDishes({...catalog,dishes:catalog.dishes.map(d=>d.name==='Tôm hấp'?{...d,price:270000}:d)},result.fields.menu,result.learnDishNames);
 assert.equal(merged.catalog.dishes.find(d=>d.name==='Tôm hấp').price,270000);assert.equal(merged.catalog.dishes.find(d=>d.name==='Gà hấp').price,320000);assert.equal(catalog.dishes[0].price,300000);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM menu_catalog').get().n,0);
});
test('failed booking save cannot teach a changed price and catalog failure does not lose a saved booking',async()=>{
 const original=booking();await api.POST(req('POST',original),db);
 const rejected=booking({menu:menu.writeMenu([{name:'Wrong price',price:900000}]),learnDishNames:['Wrong price']});assert.equal((await api.POST(req('POST',rejected),db)).status,409);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM menu_catalog').get().n,0);
 sqlite.exec('DROP TABLE menu_catalog');const next=booking({tables:['S1-02'],menu:menu.writeMenu([{name:'New',price:100000}]),learnDishNames:['New']});const response=await api.POST(req('POST',next),db);assert.equal(response.status,200);assert.ok((await response.json()).catalogWarning);assert.equal((await(await get()).json()).bookings.length,2);
});

test('natural import fills library prices only for unique matches and keeps explicit prices',()=>{
 const dishes=[{name:'Gà hấp',price:300000,unit:'đĩa'},{name:'Tôm hấp',price:250000,unit:'đĩa'},{name:'Tôm rang',price:270000,unit:'đĩa'}];
 const result=textImport.normalizeImport({name:'Anh Sơn',tableCount:2,totalPeople:12,items:[{name:'ga hap',quantity:2},{name:'Tôm hấp',quantity:2,price:200000},{name:'Tôm',quantity:1}]},{smart:true,defaultDate:'2026-10-25',dishes});
 const items=menu.readMenu(result.fields.menu);assert.equal(items[0].name,'Gà hấp');assert.equal(items[0].price,300000);assert.equal(items[0].unit,'đĩa');assert.equal(items[1].price,200000);assert.equal(items[2].price,null);
 assert.equal(result.fields.people,6);assert.equal(result.fields.date,'2026-10-25');assert.equal(result.fields.start,'18:00');assert.equal(result.fields.end,'21:00');assert.ok(result.warnings.some(w=>w.includes('thư viện')));assert.ok(result.warnings.some(w=>w.includes('tạm')));
});
test('natural import suggests vacant tables within the requested area without saving a booking',async()=>{
 await api.POST(req('POST',booking({tables:['S1-01'],start:'18:00',end:'21:00'})),db);
 const data={name:'Anh Sơn',date:'2026-10-25',start:'18:30',tableCount:2,zone:'S1',totalPeople:12,items:[{name:'Gà hấp',quantity:2}]};
 const result=await textImport.prepareNaturalImport(data,{smart:true,dishes:[{name:'Gà hấp',price:300000,unit:'đĩa'}]},db);
 assert.deepEqual(result.fields.tables,['S1-02','S1-03']);assert.equal(result.fields.people,6);assert.equal(result.fields.price,300000);assert.equal(result.fields.end,'21:30');assert.ok(result.warnings[0].includes('Gợi ý'));assert.equal((await(await get()).json()).bookings.length,1);
 const shortage=await textImport.prepareNaturalImport({...data,tableCount:8},{smart:true},db);assert.equal(shortage.fields.tables.length,0);assert.ok(shortage.warnings.some(w=>w.includes('không đủ')));
 const explicit=await textImport.prepareNaturalImport({...data,tables:['S1-01','S1-08']},{smart:true},db);assert.deepEqual(explicit.fields.tables,['S1-01','S1-08']);
});
test('natural import preserves agreed table totals and original guest count in the draft',()=>{
 const result=textImport.normalizeImport({tableCount:2,totalPeople:12,pricePerTable:1200000,deposit:500000,items:[{name:'Món chưa có giá',quantity:2}]},{smart:true,defaultDate:'2026-10-25'});
 assert.equal(result.fields.price,1200000);assert.equal(result.total,2400000);assert.equal(result.fields.deposit,500000);assert.ok(result.fields.note.includes('12 người'));assert.ok(result.fields.note.includes('2 bàn'));
 const noGuess=textImport.normalizeImport({tables:['UNKNOWN'],date:'2026-99-99',start:'26:00'},{smart:true,defaultDate:'2026-10-25'});assert.equal(noGuess.fields.date,'');assert.equal(noGuess.fields.start,'');
 const prompt=textImport.naturalPrompt(new Date('2026-10-22T20:00:00Z'));assert.ok(prompt.includes('2026-10-23'));assert.ok(prompt.includes('18:30'));assert.ok(prompt.includes('tableCount=2,zone=S1,tables=[]'));
});

test('text import computes whole-booking totals and per-table guests without duplicating dishes',()=>{
 const result=textImport.normalizeImport({name:'Anh Son',date:'2026-10-25',start:'18:00',end:'21:00',tables:['S1-07','S1-08','S1-07'],totalPeople:12,deposit:500000,items:[{name:'Ga',quantity:2,price:300000},{name:'Tom',quantity:2,price:250000},{name:'Com',quantity:2,price:100000}]});
 assert.equal(result.total,1300000);assert.equal(result.fields.price,650000);assert.equal(result.fields.people,6);assert.equal(result.fields.deposit,500000);assert.equal(result.warnings.length,0);
 const merged=textImport.normalizeImport({items:[{name:'Ga',quantity:2,price:300000},{name:'ga',quantity:3,price:300000}]});assert.equal(menu.readMenu(merged.fields.menu)[0].quantity,5);assert.equal(merged.total,1500000);
 assert.throws(()=>textImport.normalizeImport({items:[{name:'Ga',price:1},{name:'ga',price:2}]}));
});
test('text import exposes uncertain dates, tables, guests and prices',()=>{
 const result=textImport.normalizeImport({date:'2026-02-30',start:'26:00',tables:['UNKNOWN','S1-07','S1-08'],totalPeople:13,deposit:500000,items:[{name:'Ga',price:null}]});
 assert.equal(result.fields.date,'');assert.equal(result.fields.start,'');assert.equal(result.fields.deposit,0);assert.equal(menu.readMenu(result.fields.menu)[0].price,null);assert.ok(result.warnings.length>=6);assert.deepEqual(result.fields.tables,['S1-07','S1-08']);
 assert.equal(textImport.normalizeImport({date:'2026-99-99'}).fields.date,'');assert.throws(()=>textImport.normalizeImport({items:[{name:'Ga',price:-1}]}));
});
test('AI route allows more than twenty reads even after the previous quota was exhausted',async()=>{
 sqlite.exec(fs.readFileSync(new URL('./0005_text_import_usage.sql',import.meta.url),'utf8'));
 sqlite.prepare('INSERT INTO text_import_usage(day,used) VALUES (?,20)').run(new Date().toISOString().slice(0,10));
 const original=booking();await api.POST(req('POST',original),db);const before=JSON.stringify((await(await get()).json()).bookings);
 let calls=0;const env={DB:db,ASSETS:{},AI:{async run(){calls++;return{response:JSON.stringify({name:'Test',tables:['S1-07'],items:[{name:'Ga',quantity:2,price:300000}]})};}}};
 const request=()=>new Request('https://worker.example/api/import-text',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://thanson1998.github.io'},body:JSON.stringify({text:'Test AI import only'})});
 for(let i=0;i<45;i++){const r=await worker.default.fetch(request(),env);assert.equal(r.status,200);assert.equal((await r.json()).total,600000);}
 assert.equal(calls,45);assert.equal(JSON.stringify((await(await get()).json()).bookings),before);assert.equal(sqlite.prepare('SELECT used FROM text_import_usage').get().used,20);
});
test('AI route handles invalid input, unavailable binding and malformed output',async()=>{
 sqlite.exec(fs.readFileSync(new URL('./0005_text_import_usage.sql',import.meta.url),'utf8'));
 const request=text=>new Request('https://worker.example/api/import-text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
 assert.equal((await textImport.IMPORT(request(''),{DB:db})).status,400);assert.equal((await textImport.IMPORT(request('x'.repeat(6001)),{DB:db})).status,400);assert.equal((await textImport.IMPORT(request('Valid'),{DB:db})).status,503);
 assert.equal((await textImport.IMPORT(request('Valid'),{DB:db,AI:{async run(){return{response:'not json'};}}})).status,503);
 const response=await worker.default.fetch(new Request('https://worker.example/api/import-text'),{DB:db,ASSETS:{}});assert.equal(response.status,405);
});

test('table transfer atomically reserves the new tables and preserves every other booking field',async()=>{
 const original=booking({tables:['S1-01','S1-02'],price:1200000,deposit:400000,people:6,note:'Preserve this note',menu:menu.writeMenu([{name:'Original menu',price:null,quantity:2}])});
 assert.equal((await api.POST(req('POST',original),db)).status,200);
 const occupied=booking({tables:['S1-07']});assert.equal((await api.POST(req('POST',occupied),db)).status,200);
 const before=(await(await get()).json()).bookings.find(b=>b.id===original.id);
 const transfer=tables=>api.MOVE(req('POST',{id:original.id,version:1,tables,price:0,name:'Do not apply',menu:''}),db);
 assert.equal((await transfer(['S1-07','S1-08'])).status,409);
 assert.equal((await transfer(['S1-08'])).status,409);
 assert.equal((await transfer(['S1-08','S1-08'])).status,400);
 assert.equal((await transfer(['unknown','S1-08'])).status,400);
 assert.equal((await transfer(['S1-08','S1-06'])).status,200);
 const after=(await(await get()).json()).bookings.find(b=>b.id===original.id);
 assert.deepEqual(after.tables,['S1-08','S1-06']);assert.equal(after.version,2);
 const stable=b=>{const {tables,version,updatedAt,...rest}=b;return rest;};assert.deepEqual(stable(after),stable(before));
 assert.equal((await transfer(['S1-03','S1-04'])).status,409);
 assert.equal((await api.POST(req('POST',booking({tables:['S1-01','S1-02']})),db)).status,200);
 assert.equal((await api.POST(req('POST',booking({tables:['S1-08']})),db)).status,409);
 assert.equal((await api.POST(req('POST',{...before,name:'Stale draft',version:1}),db)).status,409);
});

test('transfer route supports same-day adjacent bookings, rejects cancelled orders and enforces JSON',async()=>{
 const original=booking({tables:['S1-01']});await api.POST(req('POST',original),db);
 await api.POST(req('POST',booking({tables:['S1-08'],start:'14:00',end:'16:00'})),db);
 const moveRequest=new Request('https://worker.example/api/bookings/move',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://thanson1998.github.io'},body:JSON.stringify({id:original.id,version:1,tables:['S1-08']})});
 const response=await worker.default.fetch(moveRequest,{DB:db,ASSETS:{}});assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://thanson1998.github.io');
 const current=(await(await get()).json()).bookings.find(b=>b.id===original.id);await api.POST(req('POST',{...current,status:'cancelled'}),db);
 assert.equal((await api.MOVE(req('POST',{id:original.id,version:3,tables:['S1-07']}),db)).status,409);
 assert.equal((await worker.default.fetch(new Request('https://worker.example/api/bookings/move',{method:'POST',body:'{}'}),{DB:db,ASSETS:{}})).status,415);
 const getMove=await worker.default.fetch(new Request('https://worker.example/api/bookings/move'),{DB:db,ASSETS:{}});assert.equal(getMove.status,405);assert.equal(getMove.headers.get('Allow'),'POST, OPTIONS');
});

test('explicit set quantity scales included dishes and price once, independent of selected tables',async()=>{
 sqlite.exec(fs.readFileSync(new URL('./0004_hotpot_set.sql',import.meta.url),'utf8'));
 const template=JSON.parse(sqlite.prepare('SELECT data FROM menu_catalog WHERE id=?').get('dpa-shared').data).templates[0];
 const two=menu.setMenuQuantity(template.menu,2);
 assert.equal(menu.readMenuSet(two).quantity,2);
 assert.ok(menu.readMenu(two,1).every(item=>item.quantity===2));
 assert.ok(menu.readMenu(two,4).every(item=>item.quantity===2));
 assert.equal(menu.menuSum(two,4),2400000);assert.equal(menu.pricePerSelectedTable(two,2),1200000);assert.equal(menu.pricePerSelectedTable(two,1),2400000);
 assert.equal((await api.POST(req('POST',booking({menu:two,tables:['S1-07','S1-08'],price:1200000})),db)).status,200);
 const saved=(await(await get()).json()).bookings[0];assert.equal(saved.menu,two);assert.equal(menu.readMenu(saved.menu,saved.tables.length)[0].quantity,2);
 const three=menu.setMenuQuantity(two,3);assert.ok(menu.readMenu(three,2).every(item=>item.quantity===3));assert.equal(menu.menuSum(three,2),3600000);
 const withExtra=menu.writeMenu([...menu.readMenu(two),{name:'Extra',price:100000,quantity:3}],menu.readMenuSet(two));
 const resized=menu.setMenuQuantity(withExtra,3);assert.equal(menu.readMenu(resized).at(-1).quantity,3);assert.equal(menu.menuSum(resized,5),3900000);
 assert.ok(menu.readMenu(menu.setMenuQuantity(three,1),5).every(item=>item.quantity===1));
 for(const invalid of [0,-1,1.5,1001])assert.throws(()=>menu.setMenuQuantity(two,invalid));
 const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(printModule.MenuPrintPreview,{booking:{...saved,menu:two,tables:['S1-07','S1-08']},onClose(){}}));
 assert.ok(html.includes('2 set'));assert.ok(!html.includes('dish-print-price'));
 assert.equal((html.match(/class="dish-print-count">2 [^<]+</g)||[]).length,7);
 // Existing reservations without an explicit set count retain their prior totals.
 assert.equal(menu.menuSum(template.menu,2),2400000);assert.equal(menu.readMenu(template.menu,2)[0].quantity,2);
 assert.equal(menu.menuSum(menu.setMenuQuantity(template.menu,2,2),4),2400000);
});

test('hotpot set migration preserves catalog and seeds seven included items with one set price',async()=>{
 const existing={dishes:[{id:crypto.randomUUID(),name:'Existing dish',price:100000,unit:'plate'}],templates:[{id:crypto.randomUUID(),name:'Existing template',menu:menu.writeMenu([{name:'Existing item',price:200000}])}],version:0};
 assert.equal((await catalogApi.POST_CATALOG(req('POST',existing),db)).status,200);
 const migration=fs.readFileSync(new URL('./0004_hotpot_set.sql',import.meta.url),'utf8');
 sqlite.exec(migration);sqlite.exec(migration);
 const catalog=await(await catalogApi.GET_CATALOG(new Request('https://dpa.example/api/catalog'),db)).json();
 assert.deepEqual(catalog.dishes,existing.dishes.map(d=>({...d,category:groups.inferDishGroup(d.name)})));assert.deepEqual(catalog.templates[0],existing.templates[0]);assert.equal(catalog.templates.length,2);assert.equal(catalog.version,2);
 const set=catalog.templates[1];assert.equal(menu.validMenu(set.menu),true);assert.equal(menu.readMenu(set.menu).length,7);assert.equal(menu.readMenuSet(set.menu).pricePerTable,1200000);assert.equal(menu.readMenuSet(set.menu).people,6);
 assert.ok(menu.readMenu(set.menu).every(item=>item.price===null&&item.included));
 assert.equal(menu.menuSum(set.menu,2),2400000);assert.equal(menu.pricePerSelectedTable(set.menu,2),1200000);assert.equal(menu.readMenu(set.menu,2)[0].quantity,2);
 assert.equal((await catalogApi.POST_CATALOG(req('POST',catalog),db)).status,200);
 assert.equal((await api.POST(req('POST',booking({menu:set.menu,price:1200000,people:6})),db)).status,200);
});

test('set receipt shows all dishes without individual amounts and retains the correct booking total',()=>{
 sqlite.exec(fs.readFileSync(new URL('./0004_hotpot_set.sql',import.meta.url),'utf8'));
 const stored=JSON.parse(sqlite.prepare('SELECT data FROM menu_catalog WHERE id=?').get('dpa-shared').data);
 const value=stored.templates[0].menu;
 const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(printModule.MenuPrintPreview,{booking:booking({tables:['S1-07','S1-08'],menu:value,people:6,price:1200000}),onClose(){}}));
 const text=html.replace(/<[^>]*>/g,'');
 for(const item of menu.readMenu(value))assert.ok(text.includes(item.name));
 assert.ok(text.includes('2,400,000'));assert.ok(!html.includes('dish-print-price'));assert.ok(text.includes('12 người'));
 const modified=menu.writeMenu([...menu.readMenu(value),{name:'Extra dish',price:100000,quantity:2}],menu.readMenuSet(value));
 assert.equal(menu.pricePerSelectedTable(modified,2),1300000);assert.equal(menu.validMenu(modified),true);
});

test('daily order codes are persistent, date-based and never reuse a deleted number',async()=>{
 const first=booking({date:'2026-10-22',tables:['S1-07']}),second=booking({date:'2026-10-22',tables:['S1-08']}),other=booking({date:'2026-10-23',tables:['S1-07']});
 for(const b of [first,second,other])assert.equal((await api.POST(req('POST',{...b,orderCode:'FORGED'}),db)).status,200);
 const read=async date=>(await(await api.GET(new Request('https://dpa.example/api/bookings?date='+date),db)).json()).bookings;
 let rows=await read('2026-10-22');
 assert.equal(rows.find(b=>b.id===first.id).orderCode,'DPA-22102026-01');
 assert.equal(rows.find(b=>b.id===second.id).orderCode,'DPA-22102026-02');
 assert.equal((await read('2026-10-23'))[0].orderCode,'DPA-23102026-01');
 assert.equal((await api.POST(req('POST',{...first,name:'Changed name',version:1}),db)).status,200);
 assert.equal((await read('2026-10-22')).find(b=>b.id===first.id).orderCode,'DPA-22102026-01');
 assert.equal((await api.DELETE(req('DELETE',{id:second.id,version:1}),db)).status,200);
 assert.equal((await api.POST(req('POST',booking({date:'2026-10-22',tables:['S1-08']})),db)).status,200);
 rows=await read('2026-10-22');assert.ok(rows.some(b=>b.orderCode==='DPA-22102026-03'));assert.ok(!rows.some(b=>b.orderCode==='DPA-22102026-02'));
 assert.equal((await api.POST(req('POST',{...first,date:'2026-10-23',tables:['S1-08'],version:2}),db)).status,200);
 assert.equal((await read('2026-10-23')).find(b=>b.id===first.id).orderCode,'DPA-23102026-02');
 // A refused duplicate does not advance the day counter.
 assert.equal((await api.POST(req('POST',booking({date:'2026-10-23',tables:['S1-07']})),db)).status,409);
 assert.equal((await api.POST(req('POST',booking({date:'2026-10-23',tables:['S1-06']})),db)).status,200);
 assert.ok((await read('2026-10-23')).some(b=>b.orderCode==='DPA-23102026-03'));
});

test('order-code migration numbers existing bookings once without changing booking data',()=>{
 const old=new DatabaseSync(':memory:');
 try{
  for(const file of ['0001_reservations.sql','0002_menu_catalog_deposit.sql'])old.exec(fs.readFileSync(new URL('./'+file,import.meta.url),'utf8'));
  const insert=old.prepare('INSERT INTO reservations(id,user_id,date,start,end,name,table_ids,people,platters,price,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  insert.run('a','dpa-shared','2026-10-22','11:00','14:00','A','["7"]',10,1,123456,'2026-10-20T01:00:00Z');
  insert.run('b','dpa-shared','2026-10-22','15:00','17:00','B','["8"]',12,1,500000,'2026-10-20T02:00:00Z');
  const before=old.prepare('SELECT id,date,name,price,table_ids,version,updated_at FROM reservations ORDER BY id').all();
  old.exec(fs.readFileSync(new URL('./0003_order_codes.sql',import.meta.url),'utf8'));
  assert.deepEqual(old.prepare('SELECT id,date,name,price,table_ids,version,updated_at FROM reservations ORDER BY id').all(),before);
  assert.deepEqual(old.prepare('SELECT order_code FROM reservations ORDER BY id').all().map(r=>r.order_code),['DPA-22102026-01','DPA-22102026-02']);
  insert.run('c','dpa-shared','2026-10-22','18:00','20:00','C','["9"]',10,1,250000,'2026-10-22T01:00:00Z');
  assert.equal(old.prepare('SELECT order_code FROM reservations WHERE id=?').get('c').order_code,'DPA-22102026-03');
 }finally{old.close();}
});

test('orders overview excludes cancelled value and counts menu quantities once per booking',async()=>{
 const source=fs.readFileSync(new URL('./orders-dashboard.tsx',import.meta.url),'utf8').replace("'./booking-cards'",JSON.stringify(cardsUrl)).replace("'./model'",JSON.stringify(modelUrl)).replace("'./menu'",JSON.stringify(menuUrl)).replace("'react'",JSON.stringify(pathToFileURL(require.resolve('react')).href)).replace("'lucide-react'",JSON.stringify(pathToFileURL(require.resolve('lucide-react')).href));
 const {OrdersDashboard}=await import(dataUrl(compile(source).replace('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href))));
 const rows=[booking({price:100000,tables:['S1-07','S1-08'],deposit:50000,menu:menu.writeMenu([{name:'Món minh họa',quantity:3,price:100000}])}),booking({status:'cancelled',price:9999999,deposit:99999,menu:'Món đã hủy'})];
 const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(OrdersDashboard,{bookings:rows,loading:false,error:'',date:'2026-10-25',monthly:true,onDay(){},onMonth(){},onWholeMonth(){},onOpen(){},onPrint(){}}));
 const text=html.replace(/<[^>]+>/g,'');
 assert.ok(text.includes('200,000'));assert.ok(text.includes('50,000'));assert.ok(text.includes('150,000'));
 assert.ok(!text.includes('19,999,998'));assert.ok(text.includes('3 đã đặt'));assert.ok(!text.includes('6 đã đặt'));assert.ok(!text.includes('Món đã hủy'));assert.ok(text.includes('S1-07, S1-08'));assert.ok(text.includes('Đã cọc một phần'));
});
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
 for(const expected of ['Chị Hương','Trước quầy thanh toán','Bàn 20 · Bàn 19 · Bàn 18','30 người','10 người / bàn','Gà hấp','Lẩu cá tầm',new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(1200000).replace(/\./g,','),new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(3600000).replace(/\./g,',')])assert.ok(text.includes(expected),'Missing print content: '+expected);
 assert.ok(!text.includes('mâm'),'Receipt must omit platter counts');
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
 for(const amount of [240000,180000,420000,1200000,3600000])assert.ok(html.includes(new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(amount).replace(/\./g,',')));
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
test('receipt shows compact quantity name amount rows and retains notes deposit and balance',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const b=booking({tables:['16','17'],price:1200000,deposit:500000,menu:menu.writeMenu([{name:'Gà',quantity:2,unit:'đĩa',price:240000}]),note:'Không cay; ra món lúc 19h'});
 const html=renderToStaticMarkup(React.createElement(printModule.MenuPrintPreview,{booking:b,onClose:()=>{}}));const text=html.replace(/<[^>]*>/g,'');
 for(const expected of ['Không cay; ra món lúc 19h','Đã cọc','CÒN LẠI'])assert.ok(text.includes(expected),expected);
 assert.match(html,/<li><span class="dish-print-count">2 đĩa<\/span><p>Gà<\/p><b class="dish-print-price">/);
 assert.ok(!html.includes('dish-print-quantity'));assert.ok(!text.includes('Tổng: 4 đĩa'));
 for(const amount of [480000,500000,1900000])assert.ok(text.includes(new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(amount).replace(/\./g,',')));
});

test('duplicate dishes combine quantities and retain existing edited price and unit',()=>{
 const first={name:'Trâu nướng lá lốt',price:230000,unit:'đĩa',quantity:1.25};
 const added={name:'  TRÂU  nướng lá lốt  ',price:250000,unit:'phần',quantity:2.5};
 const result=menu.mergeMenuItems([first,{name:'Cơm rang',price:100000},added]);
 assert.equal(result.length,2);assert.deepEqual(result[0],{...first,quantity:3.75});
 assert.equal(first.quantity,1.25);assert.equal(added.quantity,2.5);
 assert.equal(menu.menuSum(menu.writeMenu(result)),962500);
 const fractional=menu.mergeMenuItems([{name:'Gà',price:null,quantity:.1},{name:'Ga\u0300',price:10,quantity:.2}]);
 assert.equal(fractional.length,1);assert.equal(fractional[0].quantity,.3);assert.equal(fractional[0].price,null);
 assert.equal(menu.mergeMenuItems(Array.from({length:81},()=>({name:'Gà',price:20}))).length,1);
 assert.equal(menu.mergeMenuItems([{name:'',price:null},{name:'',price:null}]).length,2);
 assert.throws(()=>menu.mergeMenuItems([{name:'Gà',price:20,quantity:1000},{name:'gà',price:20}]),/1.000/);
});

test('unit prices use comma thousands separators without changing numeric values',()=>{
 for(const value of [0,900,1000,250000,1500000,100000000])assert.equal(menu.parseUnitPrice(menu.formatUnitPrice(value)),value);
 assert.equal(menu.formatUnitPrice(250000),'250,000');assert.equal(menu.formatUnitPrice(1500000),'1,500,000');
 assert.equal(menu.parseUnitPrice('250,000,000',4800000000),250000000);assert.equal(menu.parseUnitPrice('4,800,000,001',4800000000),undefined);assert.equal(menu.formatUnitPrice(null),'');assert.equal(menu.parseUnitPrice(''),null);assert.equal(menu.parseUnitPrice(' 250,000 '),250000);
 for(const invalid of ['-1','1.5','abc','100000001'])assert.equal(menu.parseUnitPrice(invalid),undefined);
});

test('whole-menu total divides automatically over selected tables',()=>{
 const value=menu.writeMenu([{name:'Gà',price:300000,quantity:2},{name:'Cơm',price:100000,quantity:2}]);
 assert.equal(menu.menuSum(value),800000);
 assert.equal(menu.pricePerSelectedTable(value,2),400000);
 assert.equal(menu.pricePerSelectedTable(value,4),200000);
 assert.equal(menu.pricePerSelectedTable(value,0),0);
 assert.equal(menu.pricePerSelectedTable(menu.writeMenu([]),2),0);
 assert.equal(menu.pricePerSelectedTable(menu.writeMenu([{name:'Món',price:100000,quantity:1}]),3),33333);
 assert.equal(menu.pricePerSelectedTable(menu.writeMenu([{name:'Gà',price:300000,quantity:4}]),2),600000);
});


test('dish group survives menu edits, set resizing and validation',()=>{
 const item={name:'Món đặc biệt',price:30000,unit:'cốc',quantity:2,category:'Đồ uống khác'};
 const encoded=menu.writeMenu([item]);
 assert.equal(menu.validMenu(encoded),true);
 assert.equal(menu.readMenu(encoded)[0].category,'Đồ uống khác');
 assert.equal(menu.readMenu(menu.writeMenu(menu.readMenu(encoded).map(x=>({...x,quantity:3}))))[0].category,'Đồ uống khác');
 const set={name:'Set thử',pricePerTable:100000,quantity:1};
 const bundled=menu.writeMenu([{name:'Gà',price:null,included:true,quantity:1},item],set);
 assert.equal(menu.readMenu(menu.setMenuQuantity(bundled,2)).find(x=>x.name===item.name).category,'Đồ uống khác');
 assert.equal(menu.validMenu(menu.writeMenu([{...item,category:''}])),false);
 assert.equal(menu.validMenu(menu.writeMenu([{...item,category:'a'.repeat(61)}])),false);
 assert.equal(menu.validMenu(menu.writeMenu([{name:'Món cũ',price:50000}])),true);
});

test('set dishes cannot silently absorb separately charged extras',()=>{
 const included={name:'Gà',price:null,quantity:1,included:true};
 const extra={name:'Gà',price:300000,quantity:1};
 assert.throws(()=>menu.mergeMenuItems([included,extra]),/ngoài giá set/);
 assert.throws(()=>menu.mergeMenuItems([extra,included]),/ngoài giá set/);
 assert.equal(menu.mergeMenuItems([included,{...included,quantity:2}])[0].quantity,3);
 const distinct=menu.mergeMenuItems([included,{...extra,name:'Gà gọi thêm'}]);
 assert.equal(menu.menuSum(menu.writeMenu(distinct,{name:'Lẩu',pricePerTable:1200000,quantity:1})),1500000);
});
test('payment guard detects unsaved POS changes without blocking clean or unrelated tickets',()=>{
 const b=booking(),clean={booking:b,saved:posLogic.posFingerprint(b)};
 const raw=tickets=>JSON.stringify({format:'DPA_POS_V1',tickets,selected:b.id});
 assert.equal(posLogic.hasUnsavedPosTicket(raw([clean]),b.id),false);
 assert.equal(posLogic.hasUnsavedPosTicket(raw([{...clean,booking:{...b,note:'Gọi thêm'}}]),b.id),true);
 assert.equal(posLogic.hasUnsavedPosTicket(raw([{...clean,saved:''}]),crypto.randomUUID()),false);
 assert.equal(posLogic.hasUnsavedPosTicket('invalid',b.id),false);
});
test('explicit sync settings override defaults and invalid saved values cannot blank the app',async()=>{
 const config=await import(dataUrl(compile(fs.readFileSync(new URL('./sync-config.ts',import.meta.url),'utf8'))));
 assert.equal(config.resolveApiBase(['https://selected.workers.dev','https://default.workers.dev']),'https://selected.workers.dev');
 assert.equal(config.resolveApiBase(['bad value','https://default.workers.dev']),'https://default.workers.dev');
 assert.equal(config.resolveApiBase(['javascript:alert(1)','http://unsafe.example','https://user:pass@example.com']), '');
 assert.equal(config.resolveApiBase(['http://127.0.0.1:4180']),'http://127.0.0.1:4180');
 assert.throws(()=>config.validOrigin('https://example.com/api'));
});

test('cancelling an unpaid table retains menu deposit and history while releasing all reserved tables',async()=>{
 const original=booking({tables:['N2-04','N2-05'],deposit:250000,menu:menu.writeMenu([{name:'Gà',price:300000,quantity:2,unit:'đĩa'}])});
 assert.equal((await api.POST(req('POST',original),db)).status,200);
 const current=(await(await get()).json()).bookings.find(b=>b.id===original.id);
 assert.equal((await api.POST(req('POST',{...current,status:'cancelled'}),db)).status,200);
 const cancelled=(await(await get()).json()).bookings.find(b=>b.id===original.id);
 for(const key of ['menu','deposit','price','tables','orderCode'])assert.deepEqual(cancelled[key],current[key]);
 assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.version,current.version+1);
 const history=(await(await api.HISTORY(new Request('https://dpa.example/api/history'),db)).json()).history;
 assert.ok(history.some(e=>e.booking.id===original.id&&e.booking.status==='cancelled'));
 assert.equal((await api.POST(req('POST',{...original,id:crypto.randomUUID()}),db)).status,200);
 assert.equal((await api.POST(req('POST',current),db)).status,409);
 assert.equal((await paymentsApi.PAY(req('POST',{id:cancelled.id,version:cancelled.version,total:3000000,deposit:250000,tendered:2750000,method:'cash'}),db)).status,409);
});
test('reversing payment preserves full audit and deposit, reopens the order and permits correction and repayment',async()=>{
 const original=booking({status:'arrived',tables:['S1-01','S1-02'],deposit:250000,menu:menu.writeMenu([{name:'Gà',quantity:2,price:200000}]),totalPeople:13});await api.POST(req('POST',original),db);
 const current=(await(await get()).json()).bookings[0];const paid=await(await paymentsApi.PAY(req('POST',{id:original.id,version:current.version,total:3000000,deposit:250000,tendered:2800000,method:'cash'}),db)).json();
 const request={id:original.id,version:current.version+1,paidAt:paid.payment.paidAt,reason:'Bấm nhầm, cần sửa món'};
 const response=await paymentsApi.REVERSE_PAYMENT(req('POST',request),db);assert.equal(response.status,200);const reopened=(await response.json()).booking;
 assert.equal(reopened.version,3);assert.equal(reopened.status,'arrived');assert.equal(reopened.menu,original.menu);assert.equal(reopened.deposit,250000);assert.equal(reopened.orderCode,current.orderCode);assert.equal(reopened.totalPeople,13);assert.equal(reopened.paidAt,undefined);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM booking_payments').get().n,0);
 const audit=sqlite.prepare('SELECT * FROM payment_reversals').get();assert.equal(audit.reason,request.reason);assert.deepEqual(JSON.parse(audit.payment_snapshot),paid.payment);
 const history=(await(await api.HISTORY(req('GET'),db)).json()).history[0];assert.equal(history.action,'payment_reversed');assert.equal(history.booking.paymentReversal.reason,request.reason);assert.equal(history.booking.paymentReversal.received,2750000);
 const backup=await(await api.BACKUP(req('GET'),db)).json();assert.equal(backup.paymentReversals.length,1);assert.equal(backup.payments.length,0);
 assert.equal((await paymentsApi.REVERSE_PAYMENT(req('POST',request),db)).status,409);
 assert.equal((await api.POST(req('POST',{...reopened,price:1600000}),db)).status,200);
 const paidAgain=await paymentsApi.PAY(req('POST',{id:original.id,version:4,total:3200000,deposit:250000,tendered:2950000,method:'transfer'}),db);assert.equal(paidAgain.status,200);
 assert.equal((await paymentsApi.REVERSE_PAYMENT(req('POST',request),db)).status,409);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM payment_reversals').get().n,1);
 const latest=await paidAgain.json();assert.equal((await paymentsApi.REVERSE_PAYMENT(req('POST',{...request,version:5,paidAt:latest.payment.paidAt}),db)).status,200);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM payment_reversals').get().n,2);
});
test('reversal rejects stale version, wrong payment identity, invalid reason and unpaid orders',async()=>{
 const b=booking();await api.POST(req('POST',b),db);const input={id:b.id,version:2,paidAt:new Date().toISOString(),reason:'Nhầm'};
 assert.equal((await paymentsApi.REVERSE_PAYMENT(req('POST',input),db)).status,409);
 const paid=await(await paymentsApi.PAY(req('POST',{id:b.id,version:1,total:1500000,deposit:0,tendered:1500000,method:'cash'}),db)).json();input.paidAt=paid.payment.paidAt;
 for(const changes of [{version:1},{paidAt:'2020-01-01T00:00:00.000Z'}])assert.equal((await paymentsApi.REVERSE_PAYMENT(req('POST',{...input,...changes}),db)).status,409);
 for(const reason of ['', '   ', 'a'.repeat(501)])assert.equal((await paymentsApi.REVERSE_PAYMENT(req('POST',{...input,reason}),db)).status,400);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM booking_payments').get().n,1);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM payment_reversals').get().n,0);
});
test('reversal cannot reopen a table allocated to another party, and can proceed after the conflict is moved',async()=>{
 const b=booking();await api.POST(req('POST',b),db);const paid=await(await paymentsApi.PAY(req('POST',{id:b.id,version:1,total:1500000,deposit:0,tendered:1500000,method:'cash'}),db)).json();
 const other=booking();assert.equal((await api.POST(req('POST',other),db)).status,200);
 const input={id:b.id,version:2,paidAt:paid.payment.paidAt,reason:'Sửa nhầm'};assert.equal((await paymentsApi.REVERSE_PAYMENT(req('POST',input),db)).status,409);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM booking_payments').get().n,1);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM payment_reversals').get().n,0);
 assert.equal((await api.MOVE(req('POST',{id:other.id,version:1,tables:['S1-02']}),db)).status,200);assert.equal((await paymentsApi.REVERSE_PAYMENT(req('POST',input),db)).status,200);
 assert.equal((await api.POST(req('POST',booking()),db)).status,409);
});
test('reversal rolls back the archive and unlock when the reservation update fails',async()=>{
 const b=booking();await api.POST(req('POST',b),db);const paid=await(await paymentsApi.PAY(req('POST',{id:b.id,version:1,total:1500000,deposit:0,tendered:1500000,method:'cash'}),db)).json();
 sqlite.exec("CREATE TRIGGER qa_reversal_failure BEFORE UPDATE ON reservations BEGIN SELECT RAISE(ABORT,'QA_FAIL'); END;");
 assert.equal((await paymentsApi.REVERSE_PAYMENT(req('POST',{id:b.id,version:2,paidAt:paid.payment.paidAt,reason:'Nhầm'}),db)).status,503);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM booking_payments').get().n,1);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM payment_reversals').get().n,0);const saved=(await(await get()).json()).bookings[0];assert.equal(saved.version,2);assert.ok(saved.paidAt);assert.equal(saved.status,'completed');
});
test('payment reversal route enforces allowed origins and JSON without changing any booking',async()=>{
 const env={DB:db};const url='https://dpa.example/api/payments/reverse';
 assert.equal((await worker.default.fetch(new Request(url,{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'}),env)).status,403);
 assert.equal((await worker.default.fetch(new Request(url,{method:'POST',body:'{}'}),env)).status,415);
 const ready=await worker.default.fetch(new Request(url,{method:'GET'}),env);assert.equal(ready.status,200);assert.deepEqual(await ready.json(),{available:true});
 const result=await worker.default.fetch(new Request(url,{method:'POST',headers:{Origin:'https://thanson1998.github.io','Content-Type':'application/json'},body:'{}'}),env);assert.equal(result.status,400);assert.equal(result.headers.get('Access-Control-Allow-Origin'),'https://thanson1998.github.io');
});

test('CSV export uses zero outstanding balance for settled orders and retains deposits and safe quoted cells',()=>{
 const b=booking({name:'=SUM(A1)',phone:'0900000000',tables:['S1-01','S1-02'],deposit:500000,menu:menu.writeMenu([{name:'Gà',price:300000}]),note:'Ghi chú "đặc biệt"'});
 const csv=bookingExport.bookingCsv([b,{...b,paidAt:'2026-10-23T12:00:00.000Z',status:'completed'}]);const rows=csv.split('\r\n');assert.equal(rows.length,3);assert.ok(csv.startsWith('\uFEFF'));assert.ok(rows[1].includes('"2500000"'));assert.ok(rows[2].includes('"500000","0",'));assert.ok(rows[1].includes('"\'=SUM(A1)"'));assert.ok(rows[1].includes('"Ghi chú ""đặc biệt"""'));assert.ok(rows[1].includes('"0900000000"'));assert.ok(rows[2].includes('"Hoàn tất"'));
});
test('POS rejects cancelled order actions before saving or checkout while retaining cancellation saves',()=>{
 const b=booking({status:'cancelled',menu:menu.writeMenu([{name:'Gà',price:300000}]),version:1});assert.equal(posLogic.posIssue(b,'save'),'');for(const action of ['print','pay','move'])assert.match(posLogic.posIssue(b,action),/Đơn đã hủy/);assert.equal(posLogic.posIssue({...b,status:'arrived'},'pay'),'');
});

test('unpriced menu templates print as included sets without dish prices',()=>{
 const original=menu.writeMenu(Array.from({length:14},(_,i)=>({name:'Dish '+(i+1),price:null,quantity:1,unit:'đĩa'})));
 const value=menu.prepareTemplateMenu(original,'MÂM');assert.ok(menu.validMenu(value));assert.equal(menu.readMenuSet(value).name,'MÂM');
 assert.ok(menu.readMenu(value).every(i=>i.included&&i.price===null));
 const doubled=menu.setMenuQuantity(value,2);assert.ok(menu.readMenu(doubled,3).every(i=>i.quantity===2));
 assert.equal(posLogic.posIssue(booking({menu:value,price:0,priceMode:'auto'}),'print'),'');
 const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(printModule.MenuPrintPreview,{booking:booking({menu:value,price:0}),onClose(){}}));
 assert.equal((html.match(/Trong set/g)||[]).length,14);assert.ok(!html.includes('dish-print-price'));
 const mixed=menu.writeMenu([{name:'Included',price:null,quantity:2},{name:'Extra',price:50000,quantity:3}]);
 assert.equal(menu.prepareTemplateMenu(mixed,'Mixed'),mixed);
 const marked=menu.includeUnpricedInSet(mixed);assert.ok(menu.validMenu(marked));assert.equal(menu.menuSum(marked),150000);assert.equal(menu.readMenu(marked)[1].included,undefined);
 assert.equal(menu.includeUnpricedInSet(marked),marked);
 const agreed=booking({menu:mixed,price:1200000,priceMode:'agreed'});assert.equal(bookingLogic.updateBookingDraft(agreed,'menu',marked).price,1200000);
});

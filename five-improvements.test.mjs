import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),memo=new Map();
function resolve(spec){
 if(spec.endsWith('.css'))return 'data:text/javascript,';
 if(!spec.startsWith('./'))return spec.startsWith('node:')?spec:pathToFileURL(require.resolve(spec)).href;
 if(memo.has(spec))return memo.get(spec);
 const file=[spec,spec+'.ts',spec+'.tsx'].find(p=>fs.existsSync(p));
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from ['"]([^'"]+)['"]/g,(_,s)=>'from '+JSON.stringify(resolve(s))).replace(/import ['"]([^'"]+)['"]/g,(_,s)=>'import '+JSON.stringify(resolve(s)));
 const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');memo.set(spec,url);return url;
}
const model=await import(resolve('./model')),bankModel=await import(resolve('./bank-model'));
const {GET_BANK,SAVE_BANK,SAVE_SHIFT}=await import(resolve('./pos-tools-api'));
const {BillPaymentQr}=await import(resolve('./checkout-bill')),{BankContext}=await import(resolve('./bank-context'));
const validation=await import(resolve('./booking-validation')),{posIssue,posFingerprint}=await import(resolve('./pos-logic'));
const api=await import(resolve('./api')),backup=await import(resolve('./backups-api'));
const automaticShift=await import(resolve('./automatic-shift'));
const request=(body,path='/api/bookings',method='POST')=>new Request('https://audit.invalid'+path,{method,...(method==='GET'?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
function database(){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync('.').filter(p=>/^\d{4}_.*\.sql$/.test(p)).sort())sqlite.exec(fs.readFileSync(file,'utf8'));
 const wrap=(sql,args=[])=>({bind(...values){return wrap(sql,values.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v));},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}});
 const db={prepare:sql=>wrap(sql),async batch(statements){sqlite.exec('BEGIN');try{const rows=[];for(const s of statements)rows.push(await s.all());sqlite.exec('COMMIT');return rows;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {sqlite,db};
}
const booking=()=>({id:crypto.randomUUID(),date:'2026-11-04',start:'18:00',end:'21:00',name:'Audit',phone:'',tables:['7'],people:2,totalPeople:2,platters:1,price:200000,priceMode:'agreed',deposit:10000,menu:'DPA_MENU_V1:[{"name":"Audit dish","price":200000}]',note:'',status:'reserved',version:0});
test('bank settings accept the existing payment alias and drive the same recipient on bills',async()=>{
 const {sqlite,db}=database();try{
  const defaults=await (await GET_BANK(request({}),db)).json();assert.deepEqual(defaults,bankModel.defaultBankSettings);
  const saved=await SAVE_BANK(request({...defaults,name:'Audit receiver'}),db);assert.equal(saved.status,200);
  const bank=await saved.json();assert.equal(bank.account,defaults.account);
  const html=renderToStaticMarkup(React.createElement(BankContext.Provider,{value:{bank,loading:false,error:'',reload:async()=>{},save:async()=>{}}},React.createElement(BillPaymentQr,{amount:190000,paid:false})));
  assert(html.includes('Audit receiver'));assert(html.includes(bank.account));assert(!html.includes(bankModel.defaultBankSettings.name));
  assert.equal((await SAVE_BANK(request({...defaults,account:'<script>'}),db)).status,400);
  assert.equal((await SAVE_BANK(request({...bank,version:0}),db)).status,409);
  assert.equal(bankModel.bankQr(bankModel.defaultBankSettings,190000),'./bill-payment-qr.png?v=20261028-1');
 }finally{sqlite.close();}
});
test('invalid booking fields fail locally before save and field focus targets the first error',()=>{
 const b=booking();for(const patch of [{totalPeople:0},{totalPeople:1.5},{date:'2026-02-30'},{end:'17:00'},{tableLabel:'12, 12'},{deposit:200001}])assert(Object.keys(validation.bookingFieldErrors({...b,...patch})).length);
 assert.match(posIssue({...b,totalPeople:0}),/Số khách/);assert.equal(posIssue(b),'');
 let selector='',focused=false;validation.focusBookingField({querySelector(s){selector=s;return {focus(){focused=true;},scrollIntoView(){}};}},{totalPeople:'bad'});assert(selector.includes('totalPeople'));assert(focused);
});
class MemoryStorage{data=new Map();get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
test('two POS tabs retain independent edits, survive reload, migrate legacy data and preserve conflict guards',async()=>{
 const previous={localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage};globalThis.localStorage=new MemoryStorage();
 try{
  const sessionA=new MemoryStorage(),sessionB=new MemoryStorage();globalThis.sessionStorage=sessionA;
  const a=await import(resolve('./pos-draft-storage')+'#A'),b=await import(resolve('./pos-draft-storage')+'#B');
  const original=booking(),ticketA={booking:{...original,name:'Tab A'},saved:posFingerprint(original)},ticketB={booking:{...original,name:'Tab B'},saved:posFingerprint(original)};
  a.writeCurrentPosDraft({tickets:[ticketA],selected:original.id});globalThis.sessionStorage=sessionB;b.writeCurrentPosDraft({tickets:[ticketB],selected:original.id});
  assert.equal(b.readCurrentPosDraft().tickets[0].booking.name,'Tab B');globalThis.sessionStorage=sessionA;assert.equal(a.readCurrentPosDraft().tickets[0].booking.name,'Tab A');assert(a.hasUnsavedPosDraft(original.id));
  const reloaded=await import(resolve('./pos-draft-storage')+'#reload');assert.equal(reloaded.readCurrentPosDraft().tickets[0].booking.name,'Tab A');
  const another=booking();b.writeCurrentPosDraft({tickets:[{booking:another,saved:''}],selected:another.id});const recovered=a.recoverOtherPosDrafts({tickets:[ticketA],selected:original.id});assert.equal(recovered.tickets.length,2);assert.equal(recovered.tickets[0].booking.name,'Tab A');
  globalThis.sessionStorage=new MemoryStorage();localStorage.setItem('dpa-pos-tickets-v1',JSON.stringify({format:'DPA_POS_V1',tickets:[ticketA],selected:original.id}));assert.equal(a.readCurrentPosDraft().tickets[0].booking.id,original.id);a.writeCurrentPosDraft(a.readCurrentPosDraft());assert.equal(localStorage.getItem('dpa-pos-tickets-v1'),null);
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
test('reservation drafts keep separate bookings and remove only the successfully saved draft',async()=>{
 const old=globalThis.sessionStorage;globalThis.sessionStorage=new MemoryStorage();try{const d=await import(resolve('./reservation-drafts'));const a=booking(),b=booking();d.saveReservationDraft(a,'first');d.saveReservationDraft(b,'second');assert.equal(d.readReservationDrafts().length,2);d.removeReservationDraft(a.id);assert.equal(d.readReservationDrafts()[0].booking.id,b.id);}finally{if(old===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=old;}
});
test('compressed backups round trip, verify integrity and restore one unpaid order with concurrency checks',async()=>{
 const {sqlite,db}=database();try{
  const b=booking();assert.equal((await api.POST(request(b),db)).status,200);
  const snapshot=await backup.createStoredBackup(db,'shift:audit','Audit shift'),again=await backup.createStoredBackup(db,'shift:audit','Duplicate');assert.equal(snapshot.checksum,again.checksum);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM app_backups').get().n,1);
  const download=await backup.GET_BACKUPS(request(null,'/api/backups?id=shift:audit','GET'),db);assert.equal(download.status,200);const data=await download.json();assert.equal(data.bookings[0].name,'Audit');assert(data.catalog.length);
  const updated={...b,version:1,name:'Changed'};assert.equal((await api.POST(request(updated),db)).status,200);
  const restoreBody={backupId:'shift:audit',bookingId:b.id,expectedVersion:1};assert.equal((await backup.RESTORE_BACKUP_ORDER(request(restoreBody),db)).status,409);
  restoreBody.expectedVersion=2;assert.equal((await backup.RESTORE_BACKUP_ORDER(request(restoreBody),db)).status,200);assert.equal(sqlite.prepare('SELECT name FROM reservations WHERE id=?').get(b.id).name,'Audit');
  const info=await (await backup.RESTORE_BACKUP_ORDER(request(null,'/api/backups/restore?id='+b.id,'GET'),db)).json();assert.equal(info.version,3);
  sqlite.prepare('UPDATE app_backups SET checksum=? WHERE id=?').run('tampered','shift:audit');assert.equal((await backup.GET_BACKUPS(request(null,'/api/backups?id=shift:audit','GET'),db)).status,503);
 }finally{sqlite.close();}
});
test('paid orders cannot be overwritten from a snapshot and shift saving automatically creates a backup',async()=>{
 const {sqlite,db}=database();try{
  const b=booking();assert.equal((await api.POST(request(b),db)).status,200);await backup.createStoredBackup(db,'before-payment','Before payment');
  const pay=await import(resolve('./payments-api'));assert.equal((await pay.PAY(request({id:b.id,version:1,total:200000,deposit:10000,tendered:190000,method:'cash'}),db)).status,200);
  const current=sqlite.prepare('SELECT version FROM reservations WHERE id=?').get(b.id);assert.equal((await backup.RESTORE_BACKUP_ORDER(request({backupId:'before-payment',bookingId:b.id,expectedVersion:current.version}),db)).status,409);
  const range={from:'2026-11-04T00:00:00.000Z',to:'2026-11-05T00:00:00.000Z'};const tools=await import(resolve('./pos-tools-api')),summary=await tools.shiftSummary(db,range.from,range.to),id=crypto.randomUUID();
  const response=await SAVE_SHIFT(request({...range,id,opening:0,expenses:0,counted:0,fingerprint:JSON.stringify(summary)}),db),result=await response.json();assert.equal(response.status,200);assert(result.backup.ok);assert(sqlite.prepare('SELECT id FROM app_backups WHERE id=?').get('shift:'+id));
 }finally{sqlite.close();}
});
test('daily backups use Vietnam time, deduplicate retries and retain the thirty newest snapshots',async()=>{
 const {sqlite,db}=database();try{
  await automaticShift.processAutomaticShift(db,new Date('2026-11-04T04:59:00Z'));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM app_backups').get().n,0);
  await automaticShift.processAutomaticShift(db,new Date('2026-11-04T05:00:00Z'));await automaticShift.processAutomaticShift(db,new Date('2026-11-04T05:01:00Z'));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM app_backups').get().n,1);
  for(let i=0;i<32;i++)await backup.createStoredBackup(db,'manual:'+i,'Retention audit');assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM app_backups').get().n,30);
 }finally{sqlite.close();}
});
test('noon boundaries use Vietnam dates across leap days, year changes and adjacent 24-hour periods',()=>{
 assert.equal(automaticShift.noonShiftPeriod(new Date('2026-11-04T04:59:59Z')),null);
 const current=automaticShift.noonShiftPeriod(new Date('2026-11-04T05:00:00Z'));assert.deepEqual(current,{day:'2026-11-04',from:'2026-11-03T05:00:00.000Z',to:'2026-11-04T05:00:00.000Z'});
 assert.equal(automaticShift.noonShiftPeriod(new Date('2026-11-05T05:00:00Z')).from,current.to);
 assert.equal(automaticShift.noonShiftPeriod(new Date('2028-03-01T05:00:00Z')).from,'2028-02-29T05:00:00.000Z');
 assert.equal(automaticShift.noonShiftPeriod(new Date('2027-01-01T05:00:00Z')).from,'2026-12-31T05:00:00.000Z');
});
test('automatic shifts remain frozen, keep cash counts unknown and retry a failed backup without creating duplicate reports',async()=>{
 const {sqlite,db}=database();try{
  const normal=booking();assert.equal((await api.POST(request(normal),db)).status,200);
  const {createStoredBackup}=backup;sqlite.exec('ALTER TABLE app_backups RENAME TO app_backups_unavailable');
  await assert.rejects(automaticShift.processAutomaticShift(db,new Date('2026-11-04T05:00:00Z')));
  const row=sqlite.prepare("SELECT * FROM pos_shift_reports WHERE source='automatic'").get();assert(row);const frozen=JSON.parse(row.data);for(const key of ['opening','expenses','counted','expected','difference'])assert.equal(frozen[key],null);
  assert.equal(sqlite.prepare('SELECT status FROM reservations WHERE id=?').get(normal.id).status,'reserved');
  sqlite.exec('ALTER TABLE app_backups_unavailable RENAME TO app_backups');
  const result=await automaticShift.processAutomaticShift(db,new Date('2026-11-04T05:03:00Z'));assert.deepEqual(result.report,frozen);assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM pos_shift_reports WHERE source='automatic'").get().n,1);
  assert(sqlite.prepare('SELECT id FROM app_backups WHERE id=?').get('auto-shift:2026-11-04'));
  await automaticShift.processAutomaticShift(db,new Date('2026-11-04T10:00:00Z'));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM app_backups').get().n,1);
 }finally{sqlite.close();}
});
test('noon payment totals exclude the exact next-period boundary and manual shifts stay in a separate history',async()=>{
 const {sqlite,db}=database();try{
  const pay=await import(resolve('./payments-api')),times=['2026-11-03T04:59:59.000Z','2026-11-03T05:00:00.000Z','2026-11-04T04:59:59.000Z','2026-11-04T05:00:00.000Z'];
  for(let i=0;i<times.length;i++){const b={...booking(),tables:[String(7+i)]};assert.equal((await api.POST(request(b),db)).status,200);assert.equal((await pay.PAY(request({id:b.id,version:1,total:200000,deposit:10000,tendered:190000,method:i===2?'transfer':'cash'}),db)).status,200);sqlite.prepare('UPDATE booking_payments SET paid_at=? WHERE booking_id=?').run(times[i],b.id);}
  const result=await automaticShift.processAutomaticShift(db,new Date('2026-11-04T05:00:00Z'));assert.equal(result.report.summary.paidCount,2);assert.equal(result.report.summary.cash,190000);assert.equal(result.report.summary.transfer,190000);
  const tools=await import(resolve('./pos-tools-api')),range={from:'2026-11-04T00:00:00.000Z',to:'2026-11-05T00:00:00.000Z'},summary=await tools.shiftSummary(db,range.from,range.to);assert.equal((await SAVE_SHIFT(request({...range,id:crypto.randomUUID(),opening:50000,expenses:10000,counted:230000,fingerprint:JSON.stringify(summary)}),db)).status,200);
  const history=await (await tools.GET_SHIFT(request(null,'/api/pos/shift?'+new URLSearchParams(range),'GET'),db)).json();assert.equal(history.history.length,1);assert.equal(history.history[0].source,'manual');assert.equal(history.automaticHistory.length,1);assert.equal(history.automaticHistory[0].source,'automatic');assert.equal(history.automaticHistory[0].backupReady,true);
 }finally{sqlite.close();}
});
test('backup failure keeps the saved shift and a conflicting table blocks restoration atomically',async()=>{
 const {sqlite,db}=database();try{
  const b=booking();assert.equal((await api.POST(request(b),db)).status,200);await backup.createStoredBackup(db,'conflict-audit','Before move');
  assert.equal((await api.POST(request({...b,tables:['8'],version:1}),db)).status,200);
  assert.equal((await api.POST(request({...booking(),tables:['7']}),db)).status,200);
  assert.equal((await backup.RESTORE_BACKUP_ORDER(request({backupId:'conflict-audit',bookingId:b.id,expectedVersion:2}),db)).status,409);
  assert.equal(sqlite.prepare('SELECT table_ids FROM reservations WHERE id=?').get(b.id).table_ids,'["8"]');
  sqlite.exec('DROP TABLE app_backups');const tools=await import(resolve('./pos-tools-api')),range={from:'2026-11-04T00:00:00.000Z',to:'2026-11-05T00:00:00.000Z'},summary=await tools.shiftSummary(db,range.from,range.to),id=crypto.randomUUID();
  const r=await SAVE_SHIFT(request({...range,id,opening:0,expenses:0,counted:0,fingerprint:JSON.stringify(summary)}),db),data=await r.json();assert.equal(r.status,200);assert.equal(data.backup.ok,false);assert(sqlite.prepare('SELECT id FROM pos_shift_reports WHERE id=?').get(id));
 }finally{sqlite.close();}
});
test('idle live sync uses a slower interval without delaying explicit refresh signals',async t=>{
 const previous={window:globalThis.window,document:globalThis.document};const win=new EventTarget(),doc=new EventTarget();doc.hidden=false;globalThis.window=win;globalThis.document=doc;t.mock.timers.enable({apis:['setTimeout','Date']});let stop;
 try{const {watchLiveSync}=await import(resolve('./live-sync'));let count=0;stop=watchLiveSync(()=>{count++;},{intervalMs:100,idleIntervalMs:1000,idleAfterMs:0});t.mock.timers.tick(100);t.mock.timers.tick(80);await Promise.resolve();assert.equal(count,1);t.mock.timers.tick(900);assert.equal(count,1);win.dispatchEvent(new Event('dpa-data-changed'));t.mock.timers.tick(80);await Promise.resolve();assert.equal(count,2);}finally{stop?.();t.mock.timers.reset();for(const [k,v] of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
test('live sync pauses hidden polling, refreshes on return and queues one mutation arriving during a read',async t=>{
 const previous={window:globalThis.window,document:globalThis.document};const win=new EventTarget(),doc=new EventTarget();doc.hidden=false;globalThis.window=win;globalThis.document=doc;
 t.mock.timers.enable({apis:['setTimeout','Date']});let stop;
 try{
  const {watchLiveSync}=await import(resolve('./live-sync'));let count=0,release;const read=()=>{count++;if(count===1)return new Promise(r=>{release=r;});};stop=watchLiveSync(read,{intervalMs:100,idleIntervalMs:1000,idleAfterMs:500});
  t.mock.timers.tick(100);t.mock.timers.tick(80);assert.equal(count,1);win.dispatchEvent(new Event('dpa-data-changed'));release();await Promise.resolve();t.mock.timers.tick(80);await Promise.resolve();assert.equal(count,2);
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));t.mock.timers.tick(5000);assert.equal(count,2);doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));t.mock.timers.tick(80);await Promise.resolve();assert.equal(count,3);
 }finally{stop?.();t.mock.timers.reset();for(const [k,v] of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});

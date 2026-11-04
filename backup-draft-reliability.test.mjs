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

const jobs=await import(resolve('./backup-jobs')),store=await import(resolve('./backup-store'));
test('failed noon backup retries after midnight while preserving the first shift report',async()=>{
 const {sqlite,db}=database();try{
  let fail=true;const flaky={...db,async batch(statements){if(fail)throw Error('Simulated unavailable snapshot read');return db.batch(statements);}};
  const first=await automaticShift.processAutomaticShift(flaky,new Date('2026-11-03T05:00:00Z'));assert.equal(first.backup.ok,false);assert.equal(first.backup.job.status,'failed');
  const frozen=sqlite.prepare("SELECT data FROM pos_shift_reports WHERE id='auto:2026-11-03'").get().data;fail=false;
  const recovered=await automaticShift.processAutomaticShift(flaky,new Date('2026-11-04T01:00:00Z'));assert.equal(recovered.ok,true);
  assert.equal(sqlite.prepare("SELECT data FROM pos_shift_reports WHERE id='auto:2026-11-03'").get().data,frozen);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM pos_shift_reports').get().n,1);
  assert(sqlite.prepare("SELECT id FROM app_backups WHERE id='auto-shift:2026-11-03'").get());assert.equal(sqlite.prepare("SELECT status FROM backup_jobs WHERE id='auto-shift:2026-11-03'").get().status,'succeeded');
 }finally{sqlite.close();}
});
test('retry backoff is bounded, respects due time, and concurrent workers create one snapshot',async()=>{
 const {sqlite,db}=database();try{
  let now=new Date('2026-11-04T06:00:00Z');await jobs.enqueueBackup(db,'manual:retry-test','Retry test',now.toISOString(),now);
  const flaky={...db,async batch(){throw Error('Simulated failure');}};
  for(const [attempt,delay] of [[1,1],[2,5],[3,15],[4,60]]){
   const r=await jobs.runBackupJob(flaky,'manual:retry-test',now);assert.equal(r.ok,false);assert.equal(r.job.attempts,attempt);assert.equal(Date.parse(r.job.next_attempt)-now.getTime(),delay*60000);
   assert.equal(await jobs.processBackupJobs(flaky,new Date(Date.parse(r.job.next_attempt)-1)),null);now=new Date(r.job.next_attempt);
  }
  const results=await Promise.all([jobs.runBackupJob(db,'manual:retry-test',now),jobs.runBackupJob(db,'manual:retry-test',now)]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM app_backups').get().n,1);
  const row=sqlite.prepare('SELECT * FROM backup_jobs').get();assert.equal(row.status,'succeeded');assert.equal(row.attempts,5);assert.equal(row.lease,null);
 }finally{sqlite.close();}
});
test('an expired worker lease is recoverable while an active lease prevents a duplicate',async()=>{
 const {sqlite,db}=database();try{
  const now=new Date('2026-11-04T06:00:00Z');await jobs.enqueueBackup(db,'manual:lease-test','Lease test',now.toISOString(),now);
  sqlite.prepare("UPDATE backup_jobs SET status='running',attempts=1,lease='old-worker',lease_until=?").run(now.getTime()+1000);
  assert.equal(await jobs.processBackupJobs(db,now),null);const result=await jobs.processBackupJobs(db,new Date(now.getTime()+1001));assert.equal(result.ok,true);assert.equal(sqlite.prepare('SELECT attempts FROM backup_jobs').get().attempts,2);
 }finally{sqlite.close();}
});
test('sixty-day expiry deletes only expired backup payloads, retains original data and prevents recreation',async()=>{
 const {sqlite,db}=database();try{
  const now=new Date(),cutoff=now.getTime()-60*86400000,b=booking();assert.equal((await api.POST(request(b),db)).status,200);
  for(const [id,time] of [['old',cutoff-1],['boundary',cutoff],['recent',cutoff+1000]]){const at=new Date(time);await store.createStoredBackup(db,id,'Retention test',at);await jobs.enqueueBackup(db,id,'Retention test',at.toISOString(),at);}
  const historyCount=sqlite.prepare('SELECT COUNT(*) AS n FROM reservation_history').get().n;await jobs.cleanupBackupRetention(db,now);
  assert.deepEqual(sqlite.prepare('SELECT id FROM app_backups').all().map(r=>r.id),['recent']);assert.equal(sqlite.prepare("SELECT status FROM backup_jobs WHERE id='old'").get().status,'expired');assert.equal(sqlite.prepare("SELECT status FROM backup_jobs WHERE id='boundary'").get().status,'expired');
  assert.equal((await jobs.runBackupJob(db,'old',new Date(now.getTime()+1000))).ok,false);assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM app_backups WHERE id='old'").get().n,0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM reservations').get().n,1);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM reservation_history').get().n,historyCount);
 }finally{sqlite.close();}
});
test('cleanup and missing-job reconciliation work before noon',async()=>{
 const {sqlite,db}=database();try{
  const old=new Date('2026-09-01T05:00:00Z');await store.createStoredBackup(db,'old-file','Old file',old);
  const date='2026-11-03',report={id:'auto:'+date,source:'automatic',createdAt:date+'T05:00:00.000Z'};sqlite.prepare("INSERT INTO pos_shift_reports(id,service_date,data,created_at,source) VALUES(?,?,?,?,'automatic')").run(report.id,date,JSON.stringify(report),report.createdAt);
  const result=await automaticShift.processAutomaticShift(db,new Date('2026-11-04T01:00:00Z'));assert.equal(result.ok,true);assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM app_backups WHERE id='old-file'").get().n,0);assert(sqlite.prepare("SELECT id FROM app_backups WHERE id='auto-shift:2026-11-03'").get());
 }finally{sqlite.close();}
});
test('backup job migration is idempotent and backfills old successful, missing and expired files',()=>{
 const {sqlite}=database();try{
  sqlite.exec('DROP TABLE backup_jobs');const now=new Date(),old=new Date(now.getTime()-61*86400000).toISOString();
  sqlite.prepare('INSERT INTO app_backups(id,created_at,reason,checksum,payload) VALUES(?,?,?,?,?)').run('old',old,'Old','test',new Uint8Array([1]));
  sqlite.prepare("INSERT INTO pos_shift_reports(id,service_date,data,created_at,source) VALUES(?,?,?,?,'automatic')").run('auto:pending','2026-11-04','{}',now.toISOString());
  const sql=fs.readFileSync('0030_backup_retry_jobs.sql','utf8');sqlite.exec(sql);sqlite.exec(sql);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM backup_jobs').get().n,2);assert.equal(sqlite.prepare("SELECT status FROM backup_jobs WHERE id='old'").get().status,'expired');assert.equal(sqlite.prepare("SELECT status FROM backup_jobs WHERE id='auto-shift:2026-11-04'").get().status,'queued');
 }finally{sqlite.close();}
});
class MemoryStorage{data=new Map();get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
test('actual edit time and revision survive heartbeats and recoveries ignore insertion order',async t=>{
 const prior={localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage};globalThis.localStorage=new MemoryStorage();globalThis.sessionStorage=new MemoryStorage();t.mock.timers.enable({apis:['Date'],now:10000});
 try{
  const drafts=await import(resolve('./pos-draft-storage')+'#clock-test'),b=booking(),state={tickets:[{booking:b,saved:''}],selected:b.id};drafts.writeCurrentPosDraft(state);const first=drafts.readCurrentPosDraft().tickets[0].draftMeta;assert.equal(first.editedAt,10000);
  t.mock.timers.setTime(20000);drafts.writeCurrentPosDraft(state);assert.deepEqual(drafts.readCurrentPosDraft().tickets[0].draftMeta,first);
  const older={...b,name:'Older edit'},fingerprint=posFingerprint(older);localStorage.setItem('dpa-pos-draft-owner-v2:last-inserted',JSON.stringify({updatedAt:999999,state:{format:'DPA_POS_V1',tickets:[{booking:older,saved:'',draftMeta:{editedAt:5000,revision:1,fingerprint,origin:'other'}}],selected:b.id}}));
  const current=booking(),groups=drafts.listPosDraftRecovery({tickets:[{booking:current,saved:''}],selected:current.id}),group=groups.find(g=>g.bookingId===b.id);assert.equal(group.candidates[0].ticket.booking.name,'Audit');assert.equal(group.candidates.length,2);
  t.mock.timers.setTime(30000);drafts.writeCurrentPosDraft({...state,tickets:[{booking:{...b,name:'Newest edit'},saved:''}]});const edited=drafts.readCurrentPosDraft().tickets[0].draftMeta;assert.equal(edited.editedAt,30000);assert.equal(edited.revision,2);
  t.mock.timers.setTime(90000);drafts.writeCurrentPosDraft(drafts.readCurrentPosDraft());assert.deepEqual(drafts.readCurrentPosDraft().tickets[0].draftMeta,edited);
 }finally{t.mock.timers.reset();for(const [k,v] of Object.entries(prior)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
test('conflicting drafts require a choice, preserve the current draft and never revive explicitly discarded content',async()=>{
 const prior={localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage};globalThis.localStorage=new MemoryStorage();globalThis.sessionStorage=new MemoryStorage();try{
  const d=await import(resolve('./pos-draft-storage')+'#conflict-test'),b=booking(),current={booking:b,saved:''},state={tickets:[current],selected:b.id};d.writeCurrentPosDraft(state);
  const other={booking:{...b,name:'Other tab'},saved:''};localStorage.setItem('dpa-pos-draft-owner-v2:other',JSON.stringify({updatedAt:Date.now(),state:{format:'DPA_POS_V1',tickets:[other],selected:b.id}}));
  assert.equal(d.recoverOtherPosDrafts(state).tickets[0].booking.name,'Audit');const group=d.listPosDraftRecovery(state).find(g=>g.bookingId===b.id),candidate=group.candidates.find(c=>c.ticket.booking.name==='Other tab');assert(candidate);assert.equal(candidate.editedAt,null);
  assert.throws(()=>d.applyRecoveredDraft(state,candidate,'stale fingerprint'),/vừa thay đổi/);d.preservePosDraft(current);const restored=d.applyRecoveredDraft(state,candidate,posFingerprint(b));assert.equal(restored.tickets[0].booking.name,'Other tab');assert(d.allPosDraftTickets().some(t=>t.booking.name==='Audit'));
  d.discardPosDraft(other);assert(!d.listPosDraftRecovery(state).some(g=>g.candidates.some(c=>c.ticket.booking.name==='Other tab')));
 }finally{for(const [k,v] of Object.entries(prior)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
test('retained backup lists paginate beyond thirty files with an explicit sixty-day expiry',async()=>{
 const {sqlite,db}=database();try{
  const now=new Date().toISOString();for(let i=0;i<61;i++)sqlite.prepare('INSERT INTO app_backups(id,created_at,reason,checksum,payload) VALUES(?,?,?,?,?)').run('file:'+String(i).padStart(2,'0'),now,'Test','checksum',new Uint8Array([1]));
  const first=await (await backup.GET_BACKUPS(request(null,'/api/backups','GET'),db)).json();assert.equal(first.backups.length,50);assert.equal(first.retentionDays,60);assert(first.hasMore);assert(first.backups[0].expiresAt);
  const second=await (await backup.GET_BACKUPS(request(null,'/api/backups?offset=50','GET'),db)).json();assert.equal(second.backups.length,11);assert.equal(second.hasMore,false);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM app_backups').get().n,61);
 }finally{sqlite.close();}
});

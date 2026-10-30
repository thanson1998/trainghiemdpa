import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const loaded=new Map();
function resolve(spec){if(loaded.has(spec))return loaded.get(spec);let source=fs.readFileSync(spec+'.ts','utf8');if(spec==='./api')source='export async function GET(req,db){return Response.json({bookings:db.bookings});}';const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]([^'"]+)['"]/g,(_,s)=>'from '+JSON.stringify(resolve(s)));const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');loaded.set(spec,url);return url;}
const mod=await import(resolve('./telegram-reminders'));
const at=s=>Date.parse('2026-11-06T'+s+':00+07:00');
const booking={id:'one',date:'2026-11-06',start:'18:00',end:'21:00',name:'DPA',phone:'',tables:['N2-01'],people:10,platters:1,price:1000000,menu:'',note:'',status:'reserved',version:1};
function db(){const sql=new DatabaseSync(':memory:');return {bookings:[booking],sql,prepare(q){let args=[];return {bind(...a){args=a;return this},async run(){return sql.prepare(q).run(...args)},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}}}},async batch(stmts){sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
const env=DB=>({DB,TELEGRAM_BOT_TOKEN:'123:test_only',TELEGRAM_CHAT_ID:'456',TELEGRAM_ENABLED:'true'});
const ok=()=>Promise.resolve(Response.json({ok:true,result:{message_id:7}}));
test('Vietnam schedule, opt-in and daily journal prevent duplicate reports',async()=>{
 const DB=db(),e=env(DB);let calls=0;const send=(...args)=>{calls++;return ok();};
 await mod.processBookingTelegrams(e,at('05:59'),send);assert.equal(calls,0);
 await mod.processBookingTelegrams(e,at('06:00'),send);assert.equal(calls,1);
 await mod.processBookingTelegrams(e,at('22:00'),send);assert.equal(calls,1);
 const s=await (await mod.telegramStatus(e)).json();assert.equal(s.dailyTime,'06:00');assert(!JSON.stringify(s).includes('test_only'));assert(!JSON.stringify(s).includes('456'));
 await mod.processBookingTelegrams({...e,TELEGRAM_ENABLED:'false'},at('06:00'),send);assert.equal(calls,1);
});
test('rate limit retries keep snapshot; unknown outcomes never resend blindly',async()=>{
 const DB=db(),e=env(DB),requests=[];let limited=true;
 const send=async(url,opts)=>{requests.push(opts.body);return limited?Response.json({ok:false,error_code:429,parameters:{retry_after:60}},{status:429}):ok();};
 await mod.processBookingTelegrams(e,at('06:00'),send);DB.bookings=[];
 limited=false;await mod.processBookingTelegrams(e,at('06:01'),send);assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);
 const second=db();let calls=0;const fail=async()=>{calls++;throw Error('timeout');};await mod.processBookingTelegrams(env(second),at('06:00'),fail);await mod.processBookingTelegrams(env(second),at('06:05'),fail);assert.equal(calls,1);assert.equal(second.sql.prepare('SELECT state FROM booking_telegram_jobs').get().state,'uncertain');
});
test('long reports preserve Unicode and every part resumes without repeating sent parts',async()=>{
 const text=('?? t�n m�n\n').repeat(2000),parts=mod.telegramParts(text);assert(parts.length>1);assert(parts.every(s=>s.length<=3500&&!s.includes('\uFFFD')));assert.equal(parts.join('').replaceAll('\n',''),text.replaceAll('\n',''));
 const DB=db();DB.bookings=[{...booking,note:text}];const sent=[];const send=async(url,opts)=>{const p=JSON.parse(opts.body);sent.push(p.text);assert.equal(p.chat_id,'456');assert(p.text.length<=4096);return ok();};
 for(let i=0;i<10;i++)await mod.processBookingTelegrams(env(DB),at('06:'+String(i).padStart(2,'0')),send);
 assert(sent.length>2);assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM booking_telegram_jobs').get().n,sent.length);
 assert.equal(DB.sql.prepare("SELECT COUNT(*) AS n FROM booking_telegram_jobs WHERE state<>'sent'").get().n,0);
});
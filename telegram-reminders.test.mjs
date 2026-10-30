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
test('serving orders match POS, distinguish orders from tables and never claim empty',async()=>{
 const serving=[{...booking,id:'a',name:'Serving A',status:'arrived',tables:['N2-01']},{...booking,id:'b',name:'Serving B',status:'arrived',tables:['S3-01']},{...booking,id:'c',name:'Serving C',status:'arrived',tables:['N1-01','N1-02']}];
 const report=mod.telegramSummary(serving,at('20:00'));
 assert.equal(report.openCount,3);assert.equal(report.tableCount,4);assert(report.text.includes('Đang phục vụ: 3'));assert(!report.text.includes('không có'));
 const mixed=[...serving,{...booking,id:'reserved'}, {...booking,id:'finished',status:'completed'}, {...booking,id:'pickup',serviceType:'takeaway',tables:[]}, {...booking,id:'paid',name:'EXCLUDED_PAID',paidAt:'paid'}, {...booking,id:'cancel',name:'EXCLUDED_CANCELLED',status:'cancelled'}, {...booking,id:'tomorrow',name:'EXCLUDED_TOMORROW',date:'2026-11-07'}];
 const full=mod.telegramSummary(mixed,at('20:00'));assert.equal(full.openCount,6);assert(full.text.includes('Hoàn tất, chưa thanh toán'));assert(full.text.includes('Mang về: 1'));assert(!full.text.includes('EXCLUDED_'));
 const DB=db();DB.bookings=serving;DB.sql.exec("CREATE TABLE booking_telegram_jobs(job_key TEXT PRIMARY KEY,payload TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,sent_at TEXT,message_id TEXT,error_code TEXT)");
 DB.sql.prepare("INSERT INTO booking_telegram_jobs(job_key,payload,state) VALUES(?,?,'sent')").run('interval/2026-11-06/2000/456/0000','old wrong empty report');
 const sent=[];await mod.processBookingTelegrams(env(DB),at('20:00'),async(u,o)=>{sent.push(JSON.parse(o.body).text);return ok();});await mod.processBookingTelegrams(env(DB),at('20:01'),async()=>{throw Error('must not repeat');});
 assert.equal(sent.length,1);assert(sent[0].includes('Serving A'));assert(sent[0].includes('Đơn đang mở: 3 | Bàn: 4'));
 assert(!sent[0].includes('\uFFFD'));assert(!sent[0].includes('BAO CAO D?T'));
});
test('four-hour Vietnam slots, opt-in and journal prevent duplicate reports',async()=>{
 const DB=db(),e=env(DB);let calls=0;const send=(...args)=>{calls++;return ok();};
 await mod.processBookingTelegrams(e,at('04:00'),send);assert.equal(calls,1);
 await mod.processBookingTelegrams(e,at('07:59'),send);assert.equal(calls,1);
 await mod.processBookingTelegrams(e,at('08:00'),send);assert.equal(calls,2);
 const s=await (await mod.telegramStatus(e)).json();assert.equal(s.intervalHours,4);assert.equal(s.beforeMinutes,120);assert.deepEqual(s.reportTimes,['00:00','04:00','08:00','12:00','16:00','20:00']);assert(!JSON.stringify(s).includes('test_only'));assert(!JSON.stringify(s).includes('456'));
 await mod.processBookingTelegrams({...e,TELEGRAM_ENABLED:'false'},at('12:00'),send);assert.equal(calls,2);
});
test('arrival reminders are once per booking time, handle midnight and exclude inactive orders',async()=>{
 const DB=db(),e=env(DB),sent=[];const send=async(u,o)=>{sent.push(JSON.parse(o.body).text);return ok();};
 await mod.processBookingTelegrams(e,at('15:59'),send);assert.equal(sent.filter(t=>t.startsWith('NHẮC')).length,0);
 await mod.processBookingTelegrams(e,at('16:00'),send);assert.equal(sent.filter(t=>t.startsWith('NHẮC')).length,1);
 await mod.processBookingTelegrams(e,at('16:01'),send);assert.equal(sent.filter(t=>t.startsWith('NHẮC')).length,1);
 DB.bookings=[{...booking,start:'19:00'}];await mod.processBookingTelegrams(e,at('17:00'),send);assert.equal(sent.filter(t=>t.startsWith('NHẮC')).length,2);
 const excluded=['cancelled','arrived','completed'].map((status,i)=>({...booking,id:'inactive'+i,status}));excluded.push({...booking,id:'paid',paidAt:'yes'},{...booking,id:'takeaway',serviceType:'takeaway'});
 assert.equal(mod.telegramJobs(excluded,at('16:00')).length,1);
 assert.equal(mod.telegramJobs([booking],at('18:00')).length,1);
 DB.bookings=[{...booking,id:'night',date:'2026-11-07',start:'01:00'}];
 await mod.processBookingTelegrams(e,at('23:00'),send);await mod.processBookingTelegrams(e,Date.parse('2026-11-07T00:01:00+07:00'),send);
 assert.equal(sent.filter(t=>t.startsWith('NHẮC')).length,3);
 assert(sent.find(t=>t.startsWith('NHẮC')&&t.includes('01:00')));
});
test('cancelled pending arrival is not retried; short-notice booking is reminded immediately',async()=>{
 const DB=db(),e=env(DB);let calls=0;const send=async()=>{calls++;return Response.json({ok:false,error_code:429},{status:429});};
 await mod.processBookingTelegrams(e,at('16:00'),send);const before=calls;
 DB.bookings=[{...booking,status:'cancelled'}];await mod.processBookingTelegrams(e,at('16:01'),send);
 assert.equal(DB.sql.prepare("SELECT attempts FROM booking_telegram_jobs WHERE job_key LIKE 'arrival/%'").get().attempts,1);
 assert.equal(mod.telegramJobs([booking],at('17:30')).filter(j=>j.key.startsWith('arrival/')).length,1);
 assert(calls>=before);
});
test('rate limit retries keep snapshot; unknown outcomes never resend blindly',async()=>{
 const DB=db(),e=env(DB),requests=[];let limited=true;
 const send=async(url,opts)=>{requests.push(opts.body);return limited?Response.json({ok:false,error_code:429,parameters:{retry_after:60}},{status:429}):ok();};
 await mod.processBookingTelegrams(e,at('06:00'),send);DB.bookings=[];
 limited=false;await mod.processBookingTelegrams(e,at('06:01'),send);assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);
 const second=db();let calls=0;const fail=async()=>{calls++;throw Error('timeout');};await mod.processBookingTelegrams(env(second),at('06:00'),fail);await mod.processBookingTelegrams(env(second),at('06:05'),fail);assert.equal(calls,1);assert.equal(second.sql.prepare('SELECT state FROM booking_telegram_jobs').get().state,'uncertain');
});
test('long reports preserve Unicode and every part resumes without repeating sent parts',async()=>{
 const text=('😀 tên món\n').repeat(2000),parts=mod.telegramParts(text);assert(parts.length>1);assert(parts.every(s=>s.length<=3500&&!s.includes('\uFFFD')));assert.equal(parts.join('').replaceAll('\n',''),text.replaceAll('\n',''));
 const DB=db();DB.bookings=[{...booking,note:text}];const sent=[];const send=async(url,opts)=>{const p=JSON.parse(opts.body);sent.push(p.text);assert.equal(p.chat_id,'456');assert(p.text.length<=4096);return ok();};
 for(let i=0;i<10;i++)await mod.processBookingTelegrams(env(DB),at('06:'+String(i).padStart(2,'0')),send);
 assert(sent.length>2);assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM booking_telegram_jobs').get().n,sent.length);
 assert.equal(DB.sql.prepare("SELECT COUNT(*) AS n FROM booking_telegram_jobs WHERE state<>'sent'").get().n,0);
});

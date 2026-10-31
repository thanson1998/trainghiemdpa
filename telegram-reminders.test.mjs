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
function db(){const sql=new DatabaseSync(':memory:');let batchTail=Promise.resolve();return {bookings:[booking],sql,prepare(q){let args=[];return {bind(...a){if(/LIKE\s+\?/i.test(q)&&a.some(v=>typeof v==='string'&&v.length>50&&v.includes('%')))throw Error('LIKE or GLOB pattern too complex: SQLITE_ERROR');args=a;return this},async run(){return sql.prepare(q).run(...args)},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}}}},async batch(stmts){const previous=batchTail;let release;batchTail=new Promise(r=>release=r);await previous;try{sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}finally{release();}}};}
const env=DB=>({DB,TELEGRAM_BOT_TOKEN:'123:test_only',TELEGRAM_CHAT_ID:'456',TELEGRAM_ENABLED:'true'});
const ok=()=>Promise.resolve(Response.json({ok:true,result:{message_id:7}}));
function paymentDb(withOld=false){
 const DB=db();DB.sql.exec('CREATE TABLE booking_payments(booking_id TEXT PRIMARY KEY,booking_version INTEGER,total INTEGER,deposit INTEGER,received INTEGER,tendered INTEGER,method TEXT,snapshot TEXT,paid_at TEXT)');
 const pay=(id='one',version=1,paidAt='2026-11-06T13:00:00.000Z',method='cash')=>DB.sql.prepare('INSERT INTO booking_payments VALUES(?,?,?,?,?,?,?,?,?)').run(id,version,1000000,200000,800000,method==='cash'?1000000:800000,method,JSON.stringify({...booking,id}),paidAt);
 if(withOld)pay('old');DB.sql.exec(fs.readFileSync('0023_telegram_payment_events.sql','utf8'));return {DB,pay};
}
test('only committed new payments create durable events; reversal and repayment remain distinct',async()=>{
 const {DB,pay}=paymentDb(true);assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM booking_telegram_payment_events').get().n,0);
 DB.sql.exec('BEGIN');pay();DB.sql.exec('ROLLBACK');assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM booking_telegram_payment_events').get().n,0);
 pay();assert.throws(()=>pay());assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM booking_telegram_payment_events').get().n,1);
 DB.sql.exec("DELETE FROM booking_payments WHERE booking_id='one'");pay('one',3,'2026-11-06T13:05:00.000Z','transfer');
 const messages=[];const send=async(u,o)=>{messages.push(JSON.parse(o.body));return ok();};await mod.processTelegramPayments(env(DB),at('20:06'),send);await mod.processTelegramPayments(env(DB),at('20:07'),send);
 assert.equal(messages.length,2);assert(messages.every(m=>m.chat_id==='456'&&m.text.includes('THỰC THU LẦN NÀY: 800,000')));
 assert(messages.some(m=>m.text.includes('Trả lại khách: 200,000')));assert(messages.some(m=>m.text.includes('Chuyển khoản')&&!m.text.includes('Tiền khách đưa')));
 assert.equal(DB.sql.prepare("SELECT COUNT(*) AS n FROM booking_telegram_payment_events WHERE state='sent'").get().n,2);
});
test('payment notices preserve item quantities, prices, deposit, cash change and concurrent delivery claims',async()=>{
 const {DB,pay}=paymentDb();pay();const p=JSON.parse(DB.sql.prepare('SELECT payment_snapshot FROM booking_telegram_payment_events').get().payment_snapshot);
 p.booking.menu='DPA_MENU_V1:'+JSON.stringify([{name:'Gà hấp',quantity:2,price:300000,unit:'đĩa'},{name:'Trà',quantity:4,price:50000,unit:'cốc'}]);
 const text=mod.telegramPaymentText(p);assert(text.includes('Gà hấp · 2 đĩa'));assert(text.includes('300,000'));assert(text.includes('600,000'));assert(text.includes('Đã đặt cọc: 200,000'));assert(text.includes('20:00'));assert(text.includes('06/11/2026'));
 let calls=0;const send=async()=>{calls++;await new Promise(r=>setTimeout(r,1));return ok();};
 await Promise.all([mod.processTelegramPayments(env(DB),at('20:00'),send),mod.processTelegramPayments(env(DB),at('20:00'),send)]);assert.equal(calls,1);
});
test('payment notifications retry confirmed rate limits from a frozen snapshot and never blindly repeat timeouts',async()=>{
 const {DB,pay}=paymentDb();pay();let limited=true,requests=[];const send=async(u,o)=>{requests.push(o.body);return limited?Response.json({ok:false,error_code:429},{status:429}):ok();};
 await mod.processTelegramPayments(env(DB),at('20:00'),send);DB.sql.exec('DELETE FROM booking_payments');limited=false;
 await mod.processTelegramPayments(env(DB),at('20:01'),send);assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);
 const other=paymentDb();other.pay();let calls=0;const fail=async()=>{calls++;throw Error('unknown delivery');};await mod.processTelegramPayments(env(other.DB),at('20:00'),fail);await mod.processTelegramPayments(env(other.DB),at('20:01'),fail);
 assert.equal(calls,1);assert.equal(other.DB.sql.prepare('SELECT state FROM booking_telegram_payment_events').get().state,'uncertain');
});
const checkUpdate=(id,when=at('20:00'),patch={})=>({update_id:id,message:{date:when/1000,text:'/check',from:{id:456,is_bot:false},chat:{id:456,type:'private'},...patch}});
test('/check is private to the configured owner and rejects other commands or edited messages',()=>{
 assert(mod.isTelegramCheck(checkUpdate(1),'456'));assert(mod.isTelegramCheck(checkUpdate(2,undefined,{text:'/check@dpa_baocao_2026_bot'}),'456'));
 for(const patch of [{text:'/check@another_bot'},{text:'/check tomorrow'},{text:'check'},{chat:{id:999,type:'private'}},{chat:{id:456,type:'group'}},{from:{id:999}},{from:{id:456,is_bot:true}}])assert(!mod.isTelegramCheck(checkUpdate(3,undefined,patch),'456'));
 assert(!mod.isTelegramCheck({update_id:4,edited_message:checkUpdate(4).message},'456'));
});
test('/check reports fresh POS orders once per command, keeps cursor and preserves scheduled report keys',async()=>{
 const DB=db(),e=env(DB);DB.bookings=[{...booking,status:'arrived',tables:['N1-01','N1-02']}];let updates=[checkUpdate(100)],offsets=[],replies=[];
 const send=async(url,opts)=>{const body=JSON.parse(opts.body);if(url.endsWith('/getUpdates')){offsets.push(body.offset);return Response.json({ok:true,result:updates});}replies.push(body);return ok();};
 await mod.processTelegramChecks(e,at('20:00'),send);await mod.processTelegramChecks(e,at('20:01'),send);
 assert.equal(replies.length,1);assert(replies[0].text.includes('Đơn đang mở: 1 | Bàn: 2'));assert(replies[0].text.includes('Đang phục vụ: 1'));assert.deepEqual(offsets,[0,101]);
 DB.bookings=[];updates=[checkUpdate(101,at('20:02')),checkUpdate(102,at('20:02'),{from:{id:999}})];
 await mod.processTelegramChecks({...e,TELEGRAM_ENABLED:'false'},at('20:02'),send);
 assert.equal(replies.length,2);assert(replies[1].text.includes('không có đơn đang mở'));assert.equal(DB.sql.prepare('SELECT next_offset FROM booking_telegram_poll').get().next_offset,103);
 assert.equal(DB.sql.prepare("SELECT COUNT(*) AS n FROM booking_telegram_jobs WHERE job_key NOT LIKE 'command/%'").get().n,0);
});
test('command snapshots survive rate limits, midnight and duplicate or concurrent polls',async()=>{
 const DB=db(),e=env(DB),atNight=Date.parse('2026-11-07T00:00:00+07:00');let limited=true,replies=[];const updates=[checkUpdate(200,at('23:59'))];
 const send=async(url,opts)=>{if(url.endsWith('/getUpdates'))return Response.json({ok:true,result:updates});replies.push(opts.body);return limited?Response.json({ok:false,error_code:429},{status:429}):ok();};
 await mod.processTelegramChecks(e,atNight,send);assert(replies[0].includes('06/11/2026'));
 limited=false;DB.bookings=[];await mod.processTelegramChecks(e,atNight+60000,send);assert.equal(replies.length,2);assert.equal(replies[0],replies[1]);
 await mod.processTelegramChecks(e,atNight+120000,send);assert.equal(replies.length,2);
 const another=db();let release;const blocked=new Promise(r=>release=r);const delayed=async(url)=>{if(url.endsWith('/getUpdates')){await blocked;return Response.json({ok:true,result:[]});}return ok();};
 const first=mod.processTelegramChecks(env(another),at('20:00'),delayed);
 for(let i=0;i<30&&!another.sql.prepare("SELECT name FROM sqlite_master WHERE name='booking_telegram_poll'").get();i++)await new Promise(r=>setTimeout(r,1));
 await new Promise(r=>setTimeout(r,5));const second=await mod.processTelegramChecks(env(another),at('20:00'),delayed);assert.equal(second.skipped,'poll_busy');release();await first;
});
test('a timed-out command reply is not blindly resent and poll failures preserve the cursor',async()=>{
 const DB=db(),e=env(DB);let calls=0,pollFail=false;
 const send=async(url)=>{if(url.endsWith('/getUpdates')){if(pollFail)throw Error('offline');return Response.json({ok:true,result:[checkUpdate(300)]});}calls++;throw Error('delivery unknown');};
 await mod.processTelegramChecks(e,at('20:00'),send);pollFail=true;await mod.processTelegramChecks(e,at('20:01'),send);
 assert.equal(calls,1);assert.equal(DB.sql.prepare('SELECT next_offset FROM booking_telegram_poll').get().next_offset,301);assert.equal(DB.sql.prepare('SELECT state FROM booking_telegram_jobs').get().state,'uncertain');
});
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
 await mod.processBookingTelegrams(e,at('05:59'),send);assert.equal(calls,0);
 await mod.processBookingTelegrams(e,at('06:00'),send);assert.equal(calls,1);
 await mod.processBookingTelegrams(e,at('09:59'),send);assert.equal(calls,1);
 await mod.processBookingTelegrams(e,at('10:00'),send);assert.equal(calls,2);
 const s=await (await mod.telegramStatus(e)).json();assert.equal(s.intervalHours,4);assert.equal(s.beforeMinutes,120);assert.deepEqual(s.reportTimes,['06:00','10:00','14:00','18:00','22:00']);assert(!JSON.stringify(s).includes('test_only'));assert(!JSON.stringify(s).includes('456'));
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

test('periodic reports use Vietnam 06:00–22:00 hours, include 22:00 and stay quiet overnight',async()=>{
 for(const time of ['00:00','04:00','05:59','22:01','23:59']){assert.equal(mod.telegramReportSlot(at(time)),undefined);assert.equal(mod.telegramJobs([],at(time)).length,0);}
 for(const [time,slot] of [['06:00','06:00'],['09:59','06:00'],['10:00','10:00'],['14:00','14:00'],['18:00','18:00'],['21:59','18:00'],['22:00','22:00']])assert.equal(mod.telegramReportSlot(at(time)),slot);
 const DB=db();DB.bookings=[];const calls=[];const send=async(u,o)=>{calls.push(JSON.parse(o.body).text);return ok();};
 await mod.processBookingTelegrams(env(DB),at('22:00'),send);await mod.processBookingTelegrams(env(DB),at('22:01'),send);await mod.processBookingTelegrams(env(DB),at('23:59'),send);assert.equal(calls.length,1);assert(calls[0].includes('22:00'));
 const next=Date.parse('2026-11-07T06:00:00+07:00');await mod.processBookingTelegrams(env(DB),next,send);await mod.processBookingTelegrams(env(DB),next+60000,send);assert.equal(calls.length,2);assert(calls[1].includes('06:00'));
 const status=await(await mod.telegramStatus(env(DB))).json();assert.deepEqual(status.reportWindow,{from:'06:00',to:'22:00'});
});

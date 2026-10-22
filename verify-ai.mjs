// Real inference check. Never creates bookings or changes the menu library.
const response=await fetch('https://trainghiemdpa.thanson198.workers.dev/api/import-text',{
 method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),
 body:JSON.stringify({text:'Khách Kiểm Tra AI, đặt ngày 25/10/2026 từ 18:00 đến 21:00 tại bàn S1-07, tổng 6 người. Gà hấp 2 đĩa, đơn giá 320 nghìn mỗi đĩa. Cọc 100 nghìn.'})
});
const data=await response.json();
if(!response.ok)throw new Error('Live AI check failed: HTTP '+response.status+' '+(data.code||data.error));
const {fields}=data;
if(fields.date!=='2026-10-25'||fields.start!=='18:00'||fields.end!=='21:00'||fields.tables.length!==1||fields.tables[0]!=='S1-07'||fields.people!==6||fields.price!==640000||fields.deposit!==100000)throw new Error('Live AI check returned incorrect booking fields');
console.log('LIVE_AI_IMPORT_OK: real Cloudflare inference produced the expected date, time, table, guests, dish price and deposit. No booking or catalog changes were saved.');

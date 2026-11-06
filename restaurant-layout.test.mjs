import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),memo=new Map();
function resolve(spec){
 if(spec.endsWith('.css'))return 'data:text/javascript,';
 if(!spec.startsWith('./'))return pathToFileURL(require.resolve(spec)).href;
 if(memo.has(spec))return memo.get(spec);
 const file=[spec,spec+'.ts',spec+'.tsx'].find(p=>fs.existsSync(p));
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from ['"]([^'"]+)['"]/g,(_,s)=>'from '+JSON.stringify(resolve(s))).replace(/import ['"]([^'"]+)['"]/g,(_,s)=>'import '+JSON.stringify(resolve(s)));
 const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');memo.set(spec,url);return url;
}
const {redesignRestaurant}=await import(resolve('./restaurant-layout'));
const model=await import(resolve('./model')),{readTableLayout,SAVE_LAYOUT,validConfiguredTables}=await import(resolve('./table-layout-api'));
function database(){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync('.').filter(p=>/^\d{4}_.*\.sql$/.test(p)).sort())sqlite.exec(fs.readFileSync(file,'utf8'));
 const wrap=(sql,args=[])=>({bind(...values){return wrap(sql,values);},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}});
 return {sqlite,db:{prepare:sql=>wrap(sql)}};
}
test('reference plan has twenty courtyard positions and three houses of six while preserving high bamboo exactly',()=>{
 const high={id:'NTC',title:'Nhà Tre Trên Cao',sub:'Giữ nguyên',type:'inside',count:6,tables:['a','b','c','d','e','f'],tableNames:{a:'Riêng 1'}};
 const old=[{id:'N3',title:'Trong nhà 3',type:'inside',count:4,tables:['N3-01','N3-02','N3-03','N3-04']},high,{id:'S1',title:'Sân nhà 1',type:'patio',count:2,tables:['S1-01','S1-02']}],before=JSON.stringify(old);
 const next=redesignRestaurant(old),active=next.filter(z=>!z.retired);
 assert.deepEqual(active.map(z=>z.id),['YARD','N3','N2','N1','NTC']);assert.equal(active.reduce((n,z)=>n+z.count,0),44);
 assert.deepEqual(active.slice(1,4).map(z=>z.count),[6,6,6]);assert.equal(active[0].tables.length,20);assert.deepEqual(Object.values(active[0].tableNames),Array.from({length:20},(_,i)=>String(i+1)));
 assert.equal(active[4],high);assert.equal(JSON.stringify(old),before);assert.equal(next.find(z=>z.id==='S1').retired,true);
 assert.equal(redesignRestaurant(next),next);assert.equal(new Set(next.flatMap(z=>z.tables)).size,next.flatMap(z=>z.tables).length);
});
test('stored layout upgrades once, retains every legacy ID and high bamboo, and saving active areas preserves the archive',async()=>{
 const {sqlite,db}=database();try{
  sqlite.prepare("INSERT INTO reservations(id,user_id,date,start,end,name,phone,table_ids,people,platters,price,menu,note,status,version,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(crypto.randomUUID(),'dpa-shared','2026-11-06','18:00','21:00','Existing guest','','["S1-01"]',10,1,1000000,'','Keep assignment','reserved',1,new Date().toISOString());
  const reservations=JSON.stringify(sqlite.prepare('SELECT * FROM reservations').all()),history=JSON.stringify(sqlite.prepare('SELECT * FROM reservation_history').all());
  const old=JSON.parse(sqlite.prepare("SELECT data FROM table_layout WHERE id='dpa-shared'").get().data),oldVersion=sqlite.prepare("SELECT version FROM table_layout WHERE id='dpa-shared'").get().version,high=old.find(z=>z.id==='NTC');
  const first=await readTableLayout(db),again=await readTableLayout(db);
  assert.equal(first.version,oldVersion+1);assert.equal(again.version,first.version);
  assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM reservations').all()),reservations);assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM reservation_history').all()),history);
  assert.deepEqual(first.zones.find(z=>z.id==='NTC'),high);for(const id of old.flatMap(z=>z.tables))assert(first.zones.some(z=>z.tables.includes(id)),id);
  assert.equal(await validConfiguredTables(db,['YARD-20','N3-06','S1-01']),true);
  const zones=first.zones.filter(z=>!z.retired).map(z=>({id:z.id,title:z.title,count:z.count,type:z.type,tableNames:z.tables.map(id=>z.tableNames?.[id]??id)}));
  const response=await SAVE_LAYOUT(new Request('https://test.invalid/api/table-layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:first.version,zones})}),db);
  assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.zones.find(z=>z.id==='S1').retired,true);assert.deepEqual(saved.zones.find(z=>z.id==='S1').tables,old.find(z=>z.id==='S1').tables);
 }finally{sqlite.close();}
});
test('normal map hides retired zones but an old assigned position remains inspectable without reassignment',()=>{
 const active=model.mapZones();assert.equal(active.some(z=>z.id==='S1'),false);assert.equal(active.find(z=>z.id==='YARD').count,20);
 const oldAssignment=['S1-01'];assert(model.mapZones(oldAssignment).some(z=>z.id==='S1'));assert.deepEqual(oldAssignment,['S1-01']);
 assert.equal(model.tableNumber('YARD-20'),'20');assert.equal(model.zoneOf('S1-01').retired,true);
});

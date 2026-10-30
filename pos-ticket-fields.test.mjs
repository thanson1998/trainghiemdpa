import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url),memo=new Map();
function moduleUrl(spec){
 if(!spec.startsWith('./'))return pathToFileURL(require.resolve(spec)).href;
 if(memo.has(spec))return memo.get(spec);
 const file=[spec,spec+'.ts',spec+'.tsx'].find(f=>fs.existsSync(f));
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from ['"]([^'"]+)['"]/g,(_,name)=>'from '+JSON.stringify(moduleUrl(name)));
 const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');memo.set(spec,url);return url;
}
const {PosScheduleFields,PosPricingFields}=await import(moduleUrl('./pos-ticket-fields'));
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const booking={date:'2026-10-30',start:'11:30',end:'14:30',serviceType:'dine-in',priceMode:'auto',status:'reserved',price:1500000,deposit:200000};
const render=(component,b=booking,disabled=false)=>renderToStaticMarkup(React.createElement(component,{booking:b,disabled,onChange:()=>{}}));
test('date and both service times render as editable, labeled controls',()=>{
 const html=render(PosScheduleFields);
 for(const label of ['Ngày phục vụ POS','Giờ bắt đầu POS','Giờ kết thúc POS'])assert(html.includes(label));
 assert(html.includes('type="date"'));assert(html.includes('value="11:30"'));assert(html.includes('value="14:30"'));
 assert(!html.includes('24h'));assert(!html.includes('disabled=""'));
 assert(render(PosScheduleFields,booking,true).includes('disabled=""'));
});
test('pricing preserves the selected mode, conditional agreed amount, deposit and status',()=>{
 const auto=render(PosPricingFields);assert(auto.includes('value="auto" selected=""'));
 assert(!auto.includes('Giá chốt POS mỗi bàn'));assert(auto.includes('200,000'));assert(auto.includes('Trạng thái POS'));
 const agreed=render(PosPricingFields,{...booking,priceMode:'agreed'});assert(agreed.includes('Giá chốt POS mỗi bàn'));assert(agreed.includes('1,500,000'));
 assert(render(PosPricingFields,{...booking,priceMode:'agreed',serviceType:'takeaway'}).includes('Giá đã chốt / đơn'));
});

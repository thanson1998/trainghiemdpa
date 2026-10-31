import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const modelCode=ts.transpileModule(fs.readFileSync('model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const modelUrl='data:text/javascript;base64,'+Buffer.from(modelCode).toString('base64');
const code=ts.transpileModule(fs.readFileSync('print-table-rows.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("'./model'",JSON.stringify(modelUrl));
const {printedTableRows}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('two tables share one comma-separated print row',()=>{
 assert.deepEqual(printedTableRows(['S2-01','S2-02']),['Bàn 01, Bàn 02']);
});
test('four and odd table counts use rows of at most two tables',()=>{
 assert.deepEqual(printedTableRows(['S2-01','S2-02','S2-03','S2-04']),['Bàn 01, Bàn 02','Bàn 03, Bàn 04']);
 assert.deepEqual(printedTableRows(['N2-01','N2-02','N2-03']),['Bàn 01, Bàn 02','Bàn 03']);
 assert.deepEqual(printedTableRows([]),[]);
});
test('table labels sort naturally without changing the booking selection',()=>{
 const tables=['17','8','10','9'];
 assert.deepEqual(printedTableRows(tables),['Bàn 08, Bàn 09','Bàn 10, Bàn 17']);
 assert.deepEqual(tables,['17','8','10','9']);
});

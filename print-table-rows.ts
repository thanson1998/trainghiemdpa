export function printedTableRows(tables:string[]):string[]{
 const labels=[...tables].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true})).map(id=>'Bàn '+id);
 const rows:string[]=[];
 for(let i=0;i<labels.length;i+=2)rows.push(labels.slice(i,i+2).join(', '));
 return rows;
}

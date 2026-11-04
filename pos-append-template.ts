import {readMenu,readMenuSet,writeMenu,prepareTemplateMenu,setMenuQuantity,menuSetQuantity,mergeMenuItems,validMenu,type MenuItem,type MenuSetPart} from './menu';

// Keep the existing V2 total compatible with receipts, payment and the API.
// Parts retain the original unit prices and quantities for mixed set orders.
export function appendPosTemplate(value:string,template:{name:string;menu:string},quantity:number,tableCount=1):string{
 const prepared=prepareTemplateMenu(template.menu,template.name),selected=readMenuSet(prepared);
 if(selected?.parts)throw Error('Hãy thêm từng loại set riêng từ thư viện.');
 const addedMenu=selected?setMenuQuantity(prepared,quantity):prepared;
 const previous=readMenuSet(value),before=readMenu(value,tableCount),added=readMenu(addedMenu);
 const annotate=(items:MenuItem[],name:string)=>items.map(item=>item.included?{...item,note:['Set: '+name,item.note].filter(Boolean).join(' · ')}:item);
 let result:string;
 if(!selected){
  result=writeMenu(mergeMenuItems([...before,...added]),previous?{...previous,quantity:menuSetQuantity(value,tableCount)}:undefined);
 }else if(!previous){
  result=writeMenu(mergeMenuItems([...before,...(before.length?annotate(added,selected.name):added)]),readMenuSet(addedMenu));
 }else{
  const original:MenuSetPart={name:previous.name,pricePerTable:previous.pricePerTable,quantity:menuSetQuantity(value,tableCount),...(previous.people?{people:previous.people}:{})};
  const next:MenuSetPart={name:selected.name,pricePerTable:selected.pricePerTable,quantity,...(selected.people?{people:selected.people}:{})};
  const parts=[...(previous.parts??[original]),next];
  const label=(part:MenuSetPart)=>part.quantity+' × '+part.name;
  // Never relabel previously sent dishes: kitchen deltas must only add the new set.
  const items=mergeMenuItems([...before,...annotate(added,selected.name)]);
  const name=parts.map(label).join(' + ');
  const people=parts.every(part=>part.people)?parts.reduce((sum,part)=>sum+part.people!*part.quantity,0):undefined;
  result=writeMenu(items,{name:name.length<=100?name:'Thực đơn kết hợp nhiều set',pricePerTable:parts.reduce((sum,part)=>sum+part.pricePerTable*part.quantity,0),quantity:1,parts,...(people&&people<=1000?{people}:{})});
 }
 if(!validMenu(result))throw Error('Menu vượt giới hạn: tối đa 80 món, 1.000 set và 1.000 đơn vị mỗi món.');
 return result;
}

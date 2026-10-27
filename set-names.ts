// One presentation name for templates and previously saved printable menus.
const hotpotNames=[
 'Lẩu 8 người – 1,200,000đ – Diềm tim, sụn sườn',
 'Lẩu 8 người – 1,600,000đ – Chim câu',
 'Lẩu 6 người – 1,000,000đ',
 'Lẩu 6 người – 1,200,000đ',
 'Lẩu 6 người – 1,450,000đ',
 'Lẩu 8 người – 1,200,000đ – Gầu bò',
 'Lẩu 10 người – 1,400,000đ',
 'Lẩu 10 người – 1,600,000đ',
 'Lẩu 10 người – 1,800,000đ',
 'Lẩu 10 người – 2,000,000đ',
];
const fold=(s:string)=>s.normalize('NFC').toLocaleLowerCase('vi').replace(/\./g,',').replace(/\s+/g,' ').trim();
const hotpotIds=['f710419c-0e09-49d5-a596-90c52657e56e','20950359-4dce-4050-a39e-6bfb0ef8f2ec','ab238e04-9e41-45a9-a8da-0619b4a78309','a877208f-3db9-4778-b41e-47327dd29131','7b6789a2-2eb2-4ba0-a9af-778647b65b6b','5f6904a0-c555-4907-a215-1942027e15f6','f37fb970-a68c-4c8d-a2bb-8059fe31afa7','fcdd242c-4027-4aa5-aa35-134775686c26','16b403ee-5742-4914-a22b-accbbd093ec3','0e9be7e8-9cb8-480c-afaa-ac9fd4b1555b'];
export function cleanSetName(name:string,details?:{pricePerTable:number;people?:number;itemNames?:string[]},id?:string):string{
 const text=name.normalize('NFC').trim();
 const numbered=text.match(/^Set\s+(\d+)(?:\s*\/\s*\d+)?\s*[–—-]\s*(Mâm|Lẩu)\b/iu);
 const hotpot=/^(?:Set\s+)?Lẩu\s+\d+\s*người/iu.test(text)||!!numbered&&numbered[2].toLocaleLowerCase('vi')==='lẩu';
 if(!numbered&&!hotpot)return name;
 const peopleText=text.match(/(\d+(?:\s*[–—-]\s*\d+)?)\s*người/iu)?.[1]?.replace(/\s/g,'');
 const people=details?.people??peopleText;
 const priceText=text.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:đ|₫|VND|VNĐ)/iu)?.[1];
 const price=details?.pricePerTable??(priceText?Number(priceText.replace(/[.,]/g,'')):undefined);
 if(price===undefined)return name;
 let known=id?hotpotIds.indexOf(id):-1;
 if(known<0)known=hotpotNames.findIndex(n=>fold(n)===fold(text));
 if(known<0&&hotpot){
  const stem=(s:string)=>fold(s).replace(/([đ₫]).*$/u,'$1');
  const candidates=hotpotNames.map((n,i)=>({n,i})).filter(x=>stem(x.n)===stem(text));
  if(candidates.length===1)known=candidates[0].i;
  else if(candidates.length>1){const items=fold((details?.itemNames??[]).join(' '));if(items.includes('gầu bò'))known=5;else if(items.includes('diềm tim')||items.includes('sụn sườn'))known=0;}
 }
 const number=numbered?.[1]||(known>=0?String(known+1):undefined);
 return [number?'Set '+number:undefined,(hotpot?'Lẩu':'Mâm')+(people?' '+people+' người':''),new Intl.NumberFormat('en-US').format(price)+'đ'].filter(Boolean).join(' – ');
}

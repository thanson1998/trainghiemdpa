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
export function cleanSetName(name:string,details?:{pricePerTable:number;people?:number}):string{
 const text=name.normalize('NFC').trim();
 const numbered=text.match(/^Set\s+(\d+)(?:\s*\/\s*\d+)?\s*[–—-]\s*(Mâm|Lẩu)\b/iu);
 const hotpot=/^(?:Set\s+)?Lẩu\s+\d+\s*người/iu.test(text)||!!numbered&&numbered[2].toLocaleLowerCase('vi')==='lẩu';
 if(!numbered&&!hotpot)return name;
 const peopleText=text.match(/(\d+(?:\s*[–—-]\s*\d+)?)\s*người/iu)?.[1]?.replace(/\s/g,'');
 const people=peopleText||details?.people;
 const priceText=text.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:đ|₫|VND|VNĐ)/iu)?.[1];
 const price=details?.pricePerTable??(priceText?Number(priceText.replace(/[.,]/g,'')):undefined);
 if(price===undefined)return name;
 const known=hotpotNames.findIndex(n=>fold(n)===fold(text));
 const number=numbered?.[1]||(known>=0?String(known+1):undefined);
 return [number?'Set '+number:undefined,(hotpot?'Lẩu':'Mâm')+(people?' '+people+' người':''),new Intl.NumberFormat('en-US').format(price)+'đ'].filter(Boolean).join(' – ');
}

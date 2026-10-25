// Original ChatGPT artwork added 25/10/2026; exact menu names prevent mismatched dishes.
const cells:Record<string,number>={"cá hấp xì dầu":0,"cơm rang":1,"lợn mán chiên riềng":2,"tóp mỡ dưa chua":3,"cá tầm lẩu":4,"trứng rán":5,"sườn sụn":6,"canh chua":7,"salad rau mầm":8,"cháo gà":9,"trâu nướng lá lốt":10,"gà quay":11,"canh khoai sọ rau muống":12,"nộm dạ dày hoa chuối":13,"bò cuốn cải":14,"móng giò chiên mắm":15};
const key=(name:string)=>name.normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
export function supplementalCell(name:string):number|null{return cells[key(name)]??null;}
export function supplementalPosition(cell:number){return `${(cell%4)*100/3}% ${[1.2,30.8,59.8,89.1][Math.floor(cell/4)]}%`;}

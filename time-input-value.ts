// Format complete compact input without changing unfinished or invalid times.
export function normalizeTimeInput(value:string,finish=false):string{
 const text=value.trim();
 let hours:string,minutes:string;
 if(/^\d{4}$/.test(text)){hours=text.slice(0,2);minutes=text.slice(2);}
 else if(/^\d{1,2}:\d{2}$/.test(text)){[hours,minutes]=text.split(':');}
 else if(finish&&/^\d{3}$/.test(text)){hours=text.slice(0,1);minutes=text.slice(1);}
 else if(finish&&/^\d{1,2}$/.test(text)){hours=text;minutes='00';}
 else return value;
 if(Number(hours)>23||Number(minutes)>59)return value;
 return hours.padStart(2,'0')+':'+minutes;
}

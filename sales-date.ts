export type SalesDateFilter={from:string;to:string;dateBy:'bookingDate'|'paidAt'};
export function validSalesDay(v:string){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
export function validSalesRange(from:string,to:string){return validSalesDay(from)&&validSalesDay(to)&&to>=from&&Date.parse(to)-Date.parse(from)<=366*86400000;}
export function monthRange(month:string){const end=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();return {from:month+'-01',to:month+'-'+String(end).padStart(2,'0')};}
export function paymentDay(v:string){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(v));}
export function utcSalesRange(from:string,to:string){return {from:new Date(from+'T00:00:00+07:00').toISOString(),to:new Date(Date.parse(to+'T00:00:00+07:00')+86400000).toISOString()};}

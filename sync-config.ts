export function validOrigin(value:string){
 const url=new URL(value);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Đường dẫn máy chủ phải bắt đầu bằng https://');
 if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Chỉ nhập tên miền máy chủ, không có đường dẫn phía sau.');
 return url.origin;
}
export function resolveApiBase(candidates:(string|null|undefined)[]){
 for(const value of candidates){if(!value?.trim())continue;try{return validOrigin(value.trim());}catch{}}
 return '';
}

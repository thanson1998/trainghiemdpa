export function FieldError({message,id}:{message?:string;id?:string}){return message?<small id={id} className="field-error" role="status">{message}</small>:null;}

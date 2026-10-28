import type {InputHTMLAttributes} from 'react';
import {normalizeTimeInput} from './time-input-value';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'> & {value:string;onChange:(value:string)=>void};
export function TimeInput({value,onChange,onBlur,...props}:Props){
 return <input {...props} type="text" inputMode="numeric" autoComplete="off" maxLength={5} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" value={value} onChange={e=>onChange(normalizeTimeInput(e.target.value))} onBlur={e=>{const next=normalizeTimeInput(e.currentTarget.value,true);if(next!==value)onChange(next);onBlur?.(e);}}/>;
}

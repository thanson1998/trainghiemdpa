import {createContext,useContext} from 'react';
import {defaultBankSettings,type BankSettings} from './bank-model';
export type BankState={bank:BankSettings;loading:boolean;error:string;reload:()=>Promise<void>;save:(bank:BankSettings)=>Promise<void>};
export const BankContext=createContext<BankState>({bank:defaultBankSettings,loading:false,error:'',reload:async()=>{},save:async()=>{throw Error('Chưa kết nối cấu hình thanh toán.');}});
export const useBankSettings=()=>useContext(BankContext);

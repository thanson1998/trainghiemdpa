import {billPaymentDetails} from './bill-payment-details';
export type BankSettings={bankId:string;account:string;name:string;version:number};
export const defaultBankSettings:BankSettings={bankId:'970422',account:billPaymentDetails.account,name:billPaymentDetails.name,version:0};
export const validBankAccount=(account:string)=>/^[A-Za-z0-9]{6,30}$/.test(account);
export const bankLabel=(bank:BankSettings)=>bank.bankId==='970422'?'MB - Ngân hàng Quân Đội':bank.bankId;
export function bankQr(bank:BankSettings,due:number,code='DPA'){
 if(!/^\d{6}$/.test(bank.bankId)||!validBankAccount(bank.account)||!bank.name.trim()||!Number.isSafeInteger(due)||due<=0)return '';
 // Preserve the original bank-issued QR for the existing payment alias.
 if(bank.bankId===defaultBankSettings.bankId&&bank.account===defaultBankSettings.account)return billPaymentDetails.qrUrl;
 const query=new URLSearchParams({amount:String(due),addInfo:code.replace(/[^a-zA-Z0-9 -]/g,'').slice(0,40),accountName:bank.name});
 return `https://img.vietqr.io/image/${bank.bankId}-${bank.account}-compact2.png?${query}`;
}

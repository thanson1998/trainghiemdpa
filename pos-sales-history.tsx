import {OrderHistory} from './order-history';
import type {Booking} from './model';
import type {Payment} from './payments-panel';
export function PosSalesHistory({query,onOpen,onPrint,onReceipt,onReverse,disabled=false}:{query:string;onOpen:(b:Booking)=>void;onPrint:(b:Booking)=>void;onReceipt:(p:Payment)=>void;onReverse:(p:Payment)=>void;disabled?:boolean}){return <OrderHistory query={query} paidOnly onOpen={onOpen} onPrint={onPrint} onReceipt={onReceipt} onReverse={onReverse} disabled={disabled}/>;}

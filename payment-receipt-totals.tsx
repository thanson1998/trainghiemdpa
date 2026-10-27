import {money} from './model';
export function PaymentReceiptTotals({payment:p}:{payment:{total:number;deposit:number;received:number;tendered:number;method:'cash'|'transfer'}}){
 return <div className="payment-totals">
  <p><b>Tổng tiền</b><strong>{money(p.total)}</strong></p>
  {p.deposit>0&&<p>Đã cọc<span>{money(p.deposit)}</span></p>}
  <p>Phương thức<span>{p.method==='cash'?'Tiền mặt':'Chuyển khoản'}</span></p>
  <p>Khách đưa<span>{money(p.tendered)}</span></p>
  <p>Tiền trả lại<span>{money(p.tendered-p.received)}</span></p>
 </div>;
}

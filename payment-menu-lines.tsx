import {orderUnits,money,type Booking} from './model';
import {readMenu,readMenuSet,menuSetQuantity,itemQuantity,itemUnit,itemAmount} from './menu';
export function PaymentMenuLines({booking:b}:{booking:Booking}){
 const set=readMenuSet(b.menu);
 return <div className="payment-menu">{set&&<p className="payment-menu-set"><b>{menuSetQuantity(b.menu,orderUnits(b))} × {set.name}</b><span>{money(set.pricePerTable*menuSetQuantity(b.menu,orderUnits(b)))}</span></p>}{readMenu(b.menu,orderUnits(b)).filter(i=>i.name.trim()).map((i,n)=><p className="payment-menu-item" key={n}><b className="payment-item-quantity">{itemQuantity(i)} {itemUnit(i)}</b><span className="payment-item-name">{i.name}{i.price!==null&&!i.included&&<small>Đơn giá {money(i.price)}</small>}</span><span className="payment-item-amount">{i.included?'Trong set':i.price===null?'Theo giá chốt':money(itemAmount(i))}</span></p>)}{!b.menu.trim()&&<p>Chưa nhập món ăn. Kiểm tra thực đơn trước khi thu tiền.</p>}</div>;
}

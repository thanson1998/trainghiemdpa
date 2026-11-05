import type {Booking} from './model';
import type {PosTicket} from './pos-logic';
import {updateBookingDraft} from './booking-logic';
type State={tickets:PosTicket[];selected:string};
export type PosDateChange={id:string;from:string;to:string};

// Bind an edit to the ticket which emitted it, even if selection changes before React applies it.
export function editPosTicket(state:State,id:string,key:keyof Booking,value:unknown):State{
 return {...state,tickets:state.tickets.map(t=>t.booking.id===id&&!t.booking.paidAt?{...t,booking:updateBookingDraft(t.booking,key,value)}:t)};
}
export function confirmPosDateChange(state:State,change:PosDateChange):State{
 const ticket=state.tickets.find(t=>t.booking.id===change.id);
 if(!ticket||ticket.booking.paidAt||ticket.booking.status==='cancelled'||ticket.booking.date!==change.from)throw Error('Phiếu đã thay đổi. Mở lại phiếu để kiểm tra ngày phục vụ.');
 return editPosTicket(state,change.id,'date',change.to);
}
export function posBrowseBooking(booking:Booking,date:string):Booking{
 return date===booking.date?booking:{...booking,id:'preview-'+booking.id,date,tables:[],tableLabel:undefined};
}

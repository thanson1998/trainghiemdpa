import type {Booking} from './model';
export type ReservationDraft={booking:Booking;base:string;updatedAt:string};
const key='dpa-reservation-tab-drafts-v1';
export function readReservationDrafts():ReservationDraft[]{
 try{const rows=JSON.parse(sessionStorage.getItem(key)||'[]');return Array.isArray(rows)?rows.filter(r=>r&&r.booking&&typeof r.booking.id==='string'&&typeof r.booking.name==='string'&&Array.isArray(r.booking.tables)&&typeof r.base==='string'):[];}catch{return [];}
}
export function saveReservationDraft(booking:Booking,base:string){const rows=[{booking,base,updatedAt:new Date().toISOString()},...readReservationDrafts().filter(r=>r.booking.id!==booking.id)].slice(0,30);sessionStorage.setItem(key,JSON.stringify(rows));return rows;}
export function removeReservationDraft(id:string){const rows=readReservationDrafts().filter(r=>r.booking.id!==id);sessionStorage.setItem(key,JSON.stringify(rows));return rows;}

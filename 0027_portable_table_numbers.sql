-- Portable guest numbers are optional and independent of permanent seat IDs.
ALTER TABLE reservations ADD COLUMN table_label TEXT NOT NULL DEFAULT '';

CREATE TRIGGER reservation_history_portable_number AFTER INSERT ON reservation_history
WHEN COALESCE((SELECT table_label FROM reservations WHERE id=NEW.booking_id),'')<>''
BEGIN
 UPDATE reservation_history SET snapshot=json_set(snapshot,'$.tableLabel',(SELECT table_label FROM reservations WHERE id=NEW.booking_id)) WHERE event_id=NEW.event_id;
END;

-- A numbered sign can be reused after checkout or for a non-overlapping booking.
CREATE TRIGGER portable_number_insert BEFORE INSERT ON reservations
WHEN NEW.table_label<>'' AND NEW.service_type='dine-in' AND NEW.status<>'cancelled'
AND EXISTS(SELECT 1 FROM reservations r WHERE r.user_id=NEW.user_id AND r.id<>NEW.id AND r.date=NEW.date AND r.status<>'cancelled' AND r.service_type='dine-in'
 AND NOT EXISTS(SELECT 1 FROM booking_payments p WHERE p.booking_id=r.id)
 AND r.start<NEW.end AND r.end>NEW.start AND r.table_label<>''
 AND EXISTS(SELECT 1 FROM json_each('["'||replace(replace(r.table_label,' ',''),',','","')||'"]') a JOIN json_each('["'||replace(replace(NEW.table_label,' ',''),',','","')||'"]') b ON a.value=b.value))
BEGIN SELECT RAISE(ABORT,'PORTABLE_TABLE_NUMBER_IN_USE'); END;

CREATE TRIGGER portable_number_update BEFORE UPDATE OF table_label,date,start,end,status,service_type ON reservations
WHEN NEW.table_label<>'' AND NEW.service_type='dine-in' AND NEW.status<>'cancelled'
AND NOT EXISTS(SELECT 1 FROM booking_payments p WHERE p.booking_id=NEW.id)
AND EXISTS(SELECT 1 FROM reservations r WHERE r.user_id=NEW.user_id AND r.id<>NEW.id AND r.date=NEW.date AND r.status<>'cancelled' AND r.service_type='dine-in'
 AND NOT EXISTS(SELECT 1 FROM booking_payments p WHERE p.booking_id=r.id)
 AND r.start<NEW.end AND r.end>NEW.start AND r.table_label<>''
 AND EXISTS(SELECT 1 FROM json_each('["'||replace(replace(r.table_label,' ',''),',','","')||'"]') a JOIN json_each('["'||replace(replace(NEW.table_label,' ',''),',','","')||'"]') b ON a.value=b.value))
BEGIN SELECT RAISE(ABORT,'PORTABLE_TABLE_NUMBER_IN_USE'); END;

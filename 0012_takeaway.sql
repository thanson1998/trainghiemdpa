ALTER TABLE reservations ADD COLUMN service_type TEXT NOT NULL DEFAULT 'dine-in' CHECK(service_type IN ('dine-in','takeaway'));
-- Keep real table IDs separate from takeaway orders. Existing dine-in data is unchanged.
CREATE TRIGGER reservation_service_create BEFORE INSERT ON reservations
WHEN (NEW.service_type='takeaway' AND json_array_length(NEW.table_ids)<>0) OR (NEW.service_type='dine-in' AND json_array_length(NEW.table_ids)=0)
BEGIN SELECT RAISE(ABORT,'SERVICE_TABLES_INVALID'); END;
CREATE TRIGGER reservation_service_update BEFORE UPDATE OF service_type,table_ids ON reservations
WHEN (NEW.service_type='takeaway' AND json_array_length(NEW.table_ids)<>0) OR (NEW.service_type='dine-in' AND json_array_length(NEW.table_ids)=0)
BEGIN SELECT RAISE(ABORT,'SERVICE_TABLES_INVALID'); END;
-- Existing history triggers also cover create/update/delete/payment/reversal.
-- Add the service type while the reservation still exists (including BEFORE DELETE).
CREATE TRIGGER reservation_history_service AFTER INSERT ON reservation_history
WHEN (SELECT service_type FROM reservations WHERE id=NEW.booking_id)='takeaway'
BEGIN UPDATE reservation_history SET snapshot=json_set(snapshot,'$.serviceType','takeaway') WHERE event_id=NEW.event_id; END;

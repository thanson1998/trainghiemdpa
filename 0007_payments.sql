CREATE TABLE booking_payments (
 booking_id TEXT PRIMARY KEY,
 booking_date TEXT NOT NULL,
 booking_version INTEGER NOT NULL,
 total INTEGER NOT NULL CHECK(total>=0),
 deposit INTEGER NOT NULL CHECK(deposit>=0 AND deposit<=total),
 received INTEGER NOT NULL CHECK(received=total-deposit),
 tendered INTEGER NOT NULL CHECK(tendered>=received),
 method TEXT NOT NULL CHECK(method IN ('cash','transfer')),
 snapshot TEXT NOT NULL,
 paid_at TEXT NOT NULL
);
CREATE INDEX booking_payments_date ON booking_payments(booking_date);
CREATE TRIGGER payment_complete BEFORE INSERT ON booking_payments
BEGIN
 UPDATE reservations SET status='completed',version=version+1,updated_at=NEW.paid_at
 WHERE id=NEW.booking_id AND version=NEW.booking_version;
END;
CREATE TRIGGER paid_booking_update BEFORE UPDATE ON reservations
WHEN EXISTS(SELECT 1 FROM booking_payments WHERE booking_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'PAYMENT_LOCKED'); END;
CREATE TRIGGER paid_booking_delete BEFORE DELETE ON reservations
WHEN EXISTS(SELECT 1 FROM booking_payments WHERE booking_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'PAYMENT_LOCKED'); END;

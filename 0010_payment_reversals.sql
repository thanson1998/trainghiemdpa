CREATE TABLE payment_reversals (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 booking_id TEXT NOT NULL,
 booking_version INTEGER NOT NULL,
 payment_paid_at TEXT NOT NULL,
 payment_snapshot TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
 reversed_at TEXT NOT NULL,
 UNIQUE(booking_id,booking_version)
);
CREATE INDEX payment_reversals_booking ON payment_reversals(booking_id,id);
-- Archiving, unlocking and reopening are one atomic statement/transaction.
CREATE TRIGGER payment_reverse AFTER INSERT ON payment_reversals
BEGIN
 DELETE FROM booking_payments WHERE booking_id=NEW.booking_id;
 UPDATE reservations SET
  status=CASE WHEN json_extract(NEW.payment_snapshot,'$.booking.status')='reserved' THEN 'reserved' ELSE 'arrived' END,
  version=version+1,updated_at=NEW.reversed_at
 WHERE id=NEW.booking_id AND version=NEW.booking_version;
 UPDATE reservation_history SET action='payment_reversed',
  snapshot=json_set(snapshot,'$.paymentReversal',json_object('reason',NEW.reason,'paidAt',NEW.payment_paid_at,'reversedAt',NEW.reversed_at,'received',json_extract(NEW.payment_snapshot,'$.received'),'method',json_extract(NEW.payment_snapshot,'$.method')))
 WHERE booking_id=NEW.booking_id AND version=NEW.booking_version+1;
END;

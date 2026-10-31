-- Capture only new successful payments. Existing payments are not backfilled.
-- The event survives a later reversal, and a new payment gets a new event key.
CREATE TABLE IF NOT EXISTS booking_email_payment_events (
 event_key TEXT PRIMARY KEY,
 payment_snapshot TEXT NOT NULL,
 created_at TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS email_payment_events_pending
 ON booking_email_payment_events(state,created_at,event_key);
CREATE TRIGGER IF NOT EXISTS email_payment_created AFTER INSERT ON booking_payments
BEGIN
 INSERT OR IGNORE INTO booking_email_payment_events(event_key,payment_snapshot,created_at)
 VALUES(NEW.booking_id||'/'||NEW.booking_version||'/'||NEW.paid_at,
 json_object('booking',json(NEW.snapshot),'total',NEW.total,'deposit',NEW.deposit,
 'received',NEW.received,'tendered',NEW.tendered,'method',NEW.method,'paidAt',NEW.paid_at),NEW.paid_at);
END;

CREATE TABLE IF NOT EXISTS pos_bank (
 id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS pos_shift_reports (
 id TEXT PRIMARY KEY, service_date TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pos_shift_reports_date ON pos_shift_reports(service_date,created_at);
CREATE INDEX IF NOT EXISTS booking_payments_paid_at ON booking_payments(paid_at);
CREATE INDEX IF NOT EXISTS payment_reversals_reversed_at ON payment_reversals(reversed_at);

CREATE TABLE IF NOT EXISTS booking_email_jobs (
 job_key TEXT PRIMARY KEY,
 payload TEXT NOT NULL,
 state TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL,
 next_attempt INTEGER NOT NULL DEFAULT 0,
 sent_at TEXT,
 provider_id TEXT,
 error_code TEXT
);

CREATE TABLE IF NOT EXISTS backup_jobs (
 id TEXT PRIMARY KEY,
 reason TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','expired')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt TEXT NOT NULL,
 lease TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS backup_jobs_due ON backup_jobs(status,next_attempt);
CREATE INDEX IF NOT EXISTS backup_jobs_expiry ON backup_jobs(expires_at);
INSERT INTO backup_jobs(id,reason,status,next_attempt,created_at,updated_at,expires_at)
 SELECT id,reason,CASE WHEN created_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now','-60 days') THEN 'expired' ELSE 'succeeded' END,
 created_at,created_at,created_at,strftime('%Y-%m-%dT%H:%M:%fZ',created_at,'+60 days') FROM app_backups WHERE 1
 ON CONFLICT(id) DO NOTHING;
INSERT INTO backup_jobs(id,reason,status,next_attempt,created_at,updated_at,expires_at)
 SELECT CASE WHEN source='automatic' THEN 'auto-shift:'||service_date ELSE 'shift:'||id END,
 CASE WHEN source='automatic' THEN 'Chốt ca tự động 12:00 · '||service_date ELSE 'Chốt ca thủ công' END,
 CASE WHEN created_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now','-60 days') THEN 'expired' ELSE 'queued' END,
 strftime('%Y-%m-%dT%H:%M:%fZ','now'),created_at,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ',created_at,'+60 days')
 FROM pos_shift_reports WHERE 1 ON CONFLICT(id) DO NOTHING;

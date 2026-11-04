CREATE TABLE IF NOT EXISTS app_backups (
 id TEXT PRIMARY KEY,
 created_at TEXT NOT NULL,
 reason TEXT NOT NULL,
 checksum TEXT NOT NULL,
 payload BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS app_backups_created_at ON app_backups(created_at DESC);

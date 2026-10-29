CREATE TABLE IF NOT EXISTS booking_email_settings (
 id TEXT PRIMARY KEY CHECK(id='daily'),
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 daily_time TEXT NOT NULL,
 version INTEGER NOT NULL,
 updated_at TEXT
);
INSERT OR IGNORE INTO booking_email_settings(id,enabled,daily_time,version,updated_at)
VALUES('daily',1,'06:00',1,NULL);

-- Images are stored separately from catalog revisions and from order snapshots.
CREATE TABLE IF NOT EXISTS dish_images (
 dish_id TEXT PRIMARY KEY,
 name_key TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','generating','ready','error')),
 image BLOB,
 updated_at INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0,
 lease TEXT,
 error TEXT NOT NULL DEFAULT '',
 requested_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS dish_image_usage (day TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS dish_image_lock (id INTEGER PRIMARY KEY CHECK(id=1), lease TEXT, expires INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO dish_image_lock(id,expires) VALUES(1,0);

ALTER TABLE owner_account ADD COLUMN google_subject TEXT;
CREATE TABLE IF NOT EXISTS owner_google_challenges (
 id_hash TEXT PRIMARY KEY,
 nonce_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS owner_google_challenge_expiry ON owner_google_challenges(expires_at);

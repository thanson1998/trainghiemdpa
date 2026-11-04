-- A single owner account. Credentials and sessions are deliberately excluded from sales backups.
CREATE TABLE IF NOT EXISTS owner_account (
 id INTEGER PRIMARY KEY CHECK(id=1),
 username TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS owner_sessions (
 token_hash TEXT PRIMARY KEY,
 account_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS owner_sessions_expiry ON owner_sessions(expires_at);
CREATE TABLE IF NOT EXISTS owner_auth_limits (
 bucket TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);

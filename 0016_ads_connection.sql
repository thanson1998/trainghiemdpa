-- Private credentials are intentionally excluded from /api/backup and all public reads.
CREATE TABLE IF NOT EXISTS ads_connection (
 id INTEGER PRIMARY KEY CHECK(id=1), api_key TEXT NOT NULL DEFAULT '', private_jwk TEXT NOT NULL DEFAULT '', public_jwk TEXT NOT NULL DEFAULT '', configured_at TEXT NOT NULL DEFAULT '', remaining_credits INTEGER
);
CREATE TABLE IF NOT EXISTS ads_live_cache (
 query TEXT PRIMARY KEY, data TEXT NOT NULL DEFAULT '', fetched_at TEXT NOT NULL DEFAULT '', lease_until INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS ads_search_budget (day TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0);

ALTER TABLE pos_shift_reports ADD COLUMN source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','automatic'));
CREATE INDEX IF NOT EXISTS pos_shift_reports_source_date ON pos_shift_reports(source,created_at DESC);

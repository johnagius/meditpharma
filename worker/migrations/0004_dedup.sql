-- Content-based de-duplication key so re-uploading the same PDF updates the
-- existing row instead of inserting a duplicate.
ALTER TABLE fedex_rows ADD COLUMN dedup_key TEXT;
ALTER TABLE tracking_rows ADD COLUMN dedup_key TEXT;
CREATE INDEX IF NOT EXISTS idx_fedex_dedup ON fedex_rows(dedup_key);
CREATE INDEX IF NOT EXISTS idx_tracking_dedup ON tracking_rows(dedup_key);

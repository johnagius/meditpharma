-- Owning merchant for each tracking row. Drives the "By Merchant" tab, which
-- segregates the same saved rows per merchant. Blank for rows saved before this
-- column existed; editable in the UI.
ALTER TABLE tracking_rows ADD COLUMN merchant TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_tracking_merchant ON tracking_rows(merchant);

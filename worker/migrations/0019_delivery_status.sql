-- Delivery status per tracking row (Pending / Delivered / custom). Drives the
-- status dropdown and the colour-coded dashboard totals. Rows saved before this
-- column default to Pending in the UI.
ALTER TABLE tracking_rows ADD COLUMN delivery_status TEXT DEFAULT 'Pending';
CREATE INDEX IF NOT EXISTS idx_tracking_delivery_status ON tracking_rows(delivery_status);

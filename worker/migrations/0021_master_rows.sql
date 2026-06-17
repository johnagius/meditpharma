-- Master list: a separate, persistent table with the same shape as
-- tracking_rows. Today's tracking rows are promoted (upserted by dedup_key)
-- into here, leaving previously promoted master rows untouched.
CREATE TABLE IF NOT EXISTS master_rows (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  day                 TEXT DEFAULT '',
  date                TEXT DEFAULT '',
  iso_date            TEXT DEFAULT '',
  order_number        TEXT DEFAULT '',
  tracking_number     TEXT DEFAULT '',
  product             TEXT DEFAULT '',
  quantity            TEXT DEFAULT '',
  product_description TEXT DEFAULT '',
  dest_city           TEXT DEFAULT '',
  dest_state          TEXT DEFAULT '',
  account             TEXT DEFAULT '',
  client              TEXT DEFAULT '',
  delivered_on        TEXT DEFAULT '',
  delivered_on_iso    TEXT DEFAULT '',
  delivery_status     TEXT DEFAULT 'Pending',
  comments            TEXT DEFAULT '',
  direction_remarks   TEXT DEFAULT '',
  supplier            TEXT DEFAULT '',
  pfi                 TEXT DEFAULT '',
  total_value         TEXT DEFAULT '',
  gap_ddp             TEXT DEFAULT '',
  box_dim             TEXT DEFAULT '',
  from_whom           TEXT DEFAULT '',
  shipping_cost       TEXT DEFAULT '',
  merchant            TEXT DEFAULT '',
  dedup_key           TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_master_dedup ON master_rows(dedup_key);

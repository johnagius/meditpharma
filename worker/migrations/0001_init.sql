-- Tracking rows persisted from the Meditpharma web app.
CREATE TABLE IF NOT EXISTS tracking_rows (
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
  comments            TEXT DEFAULT '',
  direction_remarks   TEXT DEFAULT '',
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

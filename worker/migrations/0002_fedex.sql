-- FedEx shipment rows persisted from the PharmaConsulta web app.
-- The full 52-column FedEx row is stored as JSON in `cells`; a few fields are
-- denormalised for readability.
CREATE TABLE IF NOT EXISTS fedex_rows (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name       TEXT DEFAULT '',
  source          TEXT DEFAULT '',
  product_key     TEXT DEFAULT '',
  product_mid     TEXT DEFAULT '',
  recipient_name  TEXT DEFAULT '',
  cells           TEXT DEFAULT '[]',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

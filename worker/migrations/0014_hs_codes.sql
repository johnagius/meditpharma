-- Editable rotating cosmetic HS-code list (description + code), rotated per row
-- onto the FedEx export and tracking product description. Seeded from the
-- built-in list; position drives the rotation order.
CREATE TABLE IF NOT EXISTS hs_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT DEFAULT '',
  code        TEXT DEFAULT '',
  status      TEXT DEFAULT 'active',
  position    INTEGER DEFAULT 0,
  dedup_key   TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hscodes_dedup ON hs_codes(dedup_key);

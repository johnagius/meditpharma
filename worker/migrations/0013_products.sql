-- Product catalog managed in the app (seeded from the built-in list). Status
-- (active/inactive/hold/withdrawn) replaces deletion so stock movements aren't
-- orphaned. Detection uses name + keywords (built-ins also keep regex patterns
-- in code, matched by key).
CREATE TABLE IF NOT EXISTS products (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  pkey                  TEXT DEFAULT '',
  name                  TEXT DEFAULT '',
  mid                   TEXT DEFAULT '',
  country               TEXT DEFAULT '',
  description           TEXT DEFAULT '',
  hs_code               TEXT DEFAULT '',
  manufacturer_name     TEXT DEFAULT '',
  manufacturing_country TEXT DEFAULT '',
  manufacturing_address TEXT DEFAULT '',
  keywords              TEXT DEFAULT '',
  status                TEXT DEFAULT 'active',
  dedup_key             TEXT,
  created_at            TEXT DEFAULT (datetime('now')),
  updated_at            TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_dedup ON products(dedup_key);

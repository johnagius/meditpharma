-- Merchant list + learned format-detection patterns.
CREATE TABLE IF NOT EXISTS merchants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS merchant_patterns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant    TEXT DEFAULT '',
  tokens      TEXT DEFAULT '[]',
  label       TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now'))
);

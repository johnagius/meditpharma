-- Key/value app settings (e.g. autosave toggles) shared across devices via D1.
CREATE TABLE IF NOT EXISTS settings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  skey        TEXT DEFAULT '',
  svalue      TEXT DEFAULT '',
  dedup_key   TEXT DEFAULT '',
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_settings_dedup ON settings(dedup_key);

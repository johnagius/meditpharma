-- One-time clean slate (round 6): delete all saved tracking rows and all saved
-- FedEx shipments for retesting. Catalog (products + HS codes), merchants and
-- learned patterns are kept. Runs once on deploy; not reversible.
DELETE FROM tracking_rows;
DELETE FROM fedex_rows;

-- Restart auto-increment ids from 1 for both tables (no-op if absent).
DELETE FROM sqlite_sequence WHERE name IN ('tracking_rows', 'fedex_rows');

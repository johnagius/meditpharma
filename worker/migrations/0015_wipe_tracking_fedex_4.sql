-- One-time clean slate (round 4): delete all saved tracking rows and all saved
-- FedEx shipments for retesting. The new product + HS-code catalogs are kept,
-- as are merchants and learned patterns. Runs once on deploy; not reversible.
DELETE FROM tracking_rows;
DELETE FROM fedex_rows;

-- Restart auto-increment ids from 1 for both tables (no-op if absent).
DELETE FROM sqlite_sequence WHERE name IN ('tracking_rows', 'fedex_rows');

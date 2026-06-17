-- Krypton-specific invoice fields on the tracking sheet plus a manual box
-- dimension column. Present globally for every merchant (blank by default);
-- filled in manually (for Krypton (KR) and for box dimensions).
ALTER TABLE tracking_rows ADD COLUMN supplier    TEXT DEFAULT '';
ALTER TABLE tracking_rows ADD COLUMN pfi         TEXT DEFAULT '';
ALTER TABLE tracking_rows ADD COLUMN total_value TEXT DEFAULT '';
ALTER TABLE tracking_rows ADD COLUMN gap_ddp     TEXT DEFAULT '';
ALTER TABLE tracking_rows ADD COLUMN box_dim     TEXT DEFAULT '';

-- Two more global tracking-sheet columns. "From Whom" defaults to the shipper
-- name for Ph.Chic orders and is blank for other merchants; "Shipping Cost" is
-- entered manually. Both remain editable for every merchant.
ALTER TABLE tracking_rows ADD COLUMN from_whom     TEXT DEFAULT '';
ALTER TABLE tracking_rows ADD COLUMN shipping_cost TEXT DEFAULT '';

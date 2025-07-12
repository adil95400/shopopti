/*
  # Extend external_suppliers type check constraint to include spocket
*/

ALTER TABLE external_suppliers
  DROP CONSTRAINT IF EXISTS external_suppliers_type_check;

ALTER TABLE external_suppliers
  ADD CONSTRAINT external_suppliers_type_check
    CHECK (type IN ('bigbuy', 'eprolo', 'cdiscount', 'autods', 'spocket'));

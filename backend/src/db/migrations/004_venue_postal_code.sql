ALTER TABLE venues ADD COLUMN postal_code VARCHAR(10)
  CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{5}$');

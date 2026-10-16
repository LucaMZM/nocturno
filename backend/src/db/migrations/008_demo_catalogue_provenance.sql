-- Provenance is explicit: real venue data and portfolio event simulations are different.
ALTER TABLE venues
  ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN source_url TEXT;

ALTER TABLE events
  ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing development fixtures retain their identity and historical commerce data.
UPDATE venues SET is_demo = TRUE WHERE id::text LIKE '10000000-%';
UPDATE events SET is_demo = TRUE WHERE id::text LIKE '40000000-%';

ALTER TABLE venues ADD CONSTRAINT venues_source_url_http
  CHECK (source_url IS NULL OR source_url ~* '^https?://[^[:space:]]+$');

-- Keep all existing event IDs, slugs, relations and historical timestamps.
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE events ALTER COLUMN updated_at DROP NOT NULL;
ALTER TABLE events ALTER COLUMN updated_at DROP DEFAULT;

CREATE INDEX IF NOT EXISTS events_public_starts_at_idx ON events (starts_at, id)
  WHERE is_active = TRUE AND deleted_at IS NULL AND status = 'PUBLISHED';

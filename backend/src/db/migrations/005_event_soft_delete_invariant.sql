UPDATE events SET is_active = FALSE, updated_at = NOW()
WHERE deleted_at IS NOT NULL AND is_active = TRUE;

ALTER TABLE events ADD CONSTRAINT events_deleted_inactive_check
  CHECK (deleted_at IS NULL OR is_active = FALSE);

CREATE INDEX events_deleted_at_idx ON events (deleted_at DESC, id)
  WHERE deleted_at IS NOT NULL;

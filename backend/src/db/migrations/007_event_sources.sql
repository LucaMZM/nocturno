ALTER TABLE events
  ADD COLUMN source_url TEXT,
  ADD COLUMN image_source_url TEXT;

ALTER TABLE events
  ADD CONSTRAINT events_source_url_http CHECK (source_url IS NULL OR source_url ~* '^https?://[^[:space:]]+$'),
  ADD CONSTRAINT events_image_source_url_http CHECK (image_source_url IS NULL OR image_source_url ~* '^https?://[^[:space:]]+$');

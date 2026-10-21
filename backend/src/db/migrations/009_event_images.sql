CREATE TABLE event_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (length(url) <= 2048 AND (url ~* '^https?://[^[:space:]]+$' OR url ~ '^/posters/[a-z0-9-]+\.svg$')),
  position INTEGER NOT NULL CHECK (position >= 0),
  alt_text VARCHAR(240),
  source_url TEXT CHECK (source_url IS NULL OR source_url ~* '^https?://[^[:space:]]+$'),
  origin VARCHAR(12) NOT NULL DEFAULT 'USER' CHECK (origin IN ('LEGACY', 'SEED', 'USER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, position),
  UNIQUE (event_id, url)
);
CREATE INDEX event_images_event_position_idx ON event_images(event_id, position);

-- Existing covers stay available without replacing any event or user data.
INSERT INTO event_images (event_id, url, position, alt_text, source_url, origin)
SELECT id, poster_url, 0, title, image_source_url, 'LEGACY'
FROM events
WHERE poster_url IS NOT NULL AND poster_url <> ''
ON CONFLICT (event_id, url) DO NOTHING;

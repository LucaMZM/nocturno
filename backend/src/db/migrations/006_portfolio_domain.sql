-- Public URLs for existing venues and promoters. Existing names are normalized once;
-- later edits keep the URL stable, unlike Event titles whose slugs intentionally change.
ALTER TABLE venues ADD COLUMN slug VARCHAR(220);
ALTER TABLE promoters ADD COLUMN slug VARCHAR(220);

WITH stems AS (
  SELECT id, COALESCE(NULLIF(trim(both '-' FROM regexp_replace(
    lower(translate(name, 'ÁÉÍÓÚÜÑÀÈÌÒÙÇáéíóúüñàèìòùç',
                          'AEIOUUNAEIOUCaeiouunaeiouc')),
    '[^a-z0-9]+', '-', 'g')), ''), 'local') AS stem FROM venues
), numbered AS (
  SELECT id, stem, row_number() OVER (PARTITION BY stem ORDER BY id) AS position FROM stems
)
UPDATE venues v SET slug = n.stem || CASE WHEN n.position = 1 THEN ''
  ELSE '-' || replace(v.id::text, '-', '') END FROM numbered n WHERE n.id = v.id;

WITH stems AS (
  SELECT id, COALESCE(NULLIF(trim(both '-' FROM regexp_replace(
    lower(translate(name, 'ÁÉÍÓÚÜÑÀÈÌÒÙÇáéíóúüñàèìòùç',
                          'AEIOUUNAEIOUCaeiouunaeiouc')),
    '[^a-z0-9]+', '-', 'g')), ''), 'promotor') AS stem FROM promoters
), numbered AS (
  SELECT id, stem, row_number() OVER (PARTITION BY stem ORDER BY id) AS position FROM stems
)
UPDATE promoters p SET slug = n.stem || CASE WHEN n.position = 1 THEN ''
  ELSE '-' || replace(p.id::text, '-', '') END FROM numbered n WHERE n.id = p.id;

ALTER TABLE venues ALTER COLUMN slug SET NOT NULL;
ALTER TABLE promoters ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX venues_slug_key ON venues(slug);
CREATE UNIQUE INDEX promoters_slug_key ON promoters(slug);

CREATE TABLE event_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL CHECK (email = lower(email)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX event_waitlist_event_created_idx ON event_waitlist(event_id, created_at DESC);

ALTER TABLE payments ADD COLUMN refund_requested_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN provider_refund_id TEXT UNIQUE;

ALTER TABLE order_items ADD COLUMN event_title_snapshot VARCHAR(180);
ALTER TABLE order_items ADD COLUMN venue_name_snapshot VARCHAR(160);
ALTER TABLE order_items ADD COLUMN starts_at_snapshot TIMESTAMPTZ;
UPDATE order_items oi SET event_title_snapshot = e.title,
  venue_name_snapshot = v.name, starts_at_snapshot = e.starts_at
FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.id = oi.event_id;
ALTER TABLE order_items ALTER COLUMN event_title_snapshot SET NOT NULL;
ALTER TABLE order_items ALTER COLUMN venue_name_snapshot SET NOT NULL;
ALTER TABLE order_items ALTER COLUMN starts_at_snapshot SET NOT NULL;

ALTER TABLE events
ADD COLUMN gallery_user_edited BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing user images already prove that the gallery was edited before this migration.
UPDATE events e SET gallery_user_edited = TRUE
WHERE EXISTS (
  SELECT 1 FROM event_images image
  WHERE image.event_id = e.id AND image.origin = 'USER'
);

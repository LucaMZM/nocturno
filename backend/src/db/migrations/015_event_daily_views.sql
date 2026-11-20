-- Solo contadores agregados. No contiene IP, usuario ni identificadores de sesión.
CREATE TABLE event_daily_views (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  views BIGINT NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (event_id, day)
);
CREATE INDEX event_daily_views_day_idx ON event_daily_views(day);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_lower CHECK (email = lower(email))
);
CREATE TABLE promoters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  description TEXT,
  email VARCHAR(320),
  phone VARCHAR(40),
  website_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  description TEXT,
  type VARCHAR(30) NOT NULL CHECK (type IN ('CLUB','DISCOTHEQUE','BAR','PUB','ROOFTOP','BEACH_CLUB','CONCERT_HALL','FESTIVAL_SITE','OUTDOOR','OTHER')),
  province VARCHAR(120) NOT NULL,
  municipality VARCHAR(120) NOT NULL,
  zone VARCHAR(120),
  address VARCHAR(240) NOT NULL,
  latitude NUMERIC(9,6) CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
  capacity INTEGER CHECK (capacity >= 0),
  minimum_age INTEGER CHECK (minimum_age >= 0),
  website_url TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
  promoter_id UUID REFERENCES promoters(id) ON DELETE RESTRICT,
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('CLUB','RAVE','CONCERT','FESTIVAL','ROOFTOP','BEACH_CLUB','BOAT_PARTY','PUB','AFTER','JAZZ_CLUB','LIVE_SESSION','OTHER')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  minimum_age INTEGER CHECK (minimum_age >= 0),
  dress_code VARCHAR(30) CHECK (dress_code IN ('CASUAL','SMART_CASUAL','ELEGANT','STREETWEAR','NO_DRESS_CODE')),
  music_genres TEXT[] NOT NULL DEFAULT '{}',
  atmosphere TEXT[] NOT NULL DEFAULT '{}',
  ideal_for TEXT[] NOT NULL DEFAULT '{}',
  poster_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_REVIEW','PUBLISHED','SOLD_OUT','CANCELLED','FINISHED','REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_dates CHECK (ends_at > starts_at)
);
CREATE TABLE ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  sold INTEGER NOT NULL DEFAULT 0 CHECK (sold >= 0),
  sales_start TIMESTAMPTZ,
  sales_end TIMESTAMPTZ,
  max_per_user INTEGER CHECK (max_per_user > 0),
  benefits TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ticket_types_sold_quantity CHECK (sold <= quantity),
  CONSTRAINT ticket_types_sales_dates CHECK (sales_start IS NULL OR sales_end IS NULL OR sales_end > sales_start)
);
CREATE TABLE favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX events_venue_id_idx ON events(venue_id);
CREATE INDEX events_promoter_id_idx ON events(promoter_id);
CREATE INDEX events_starts_at_idx ON events(starts_at);
CREATE INDEX events_status_starts_at_idx ON events(status, starts_at);
CREATE INDEX venues_municipality_idx ON venues(municipality);
CREATE INDEX venues_province_idx ON venues(province);
CREATE INDEX ticket_types_event_id_idx ON ticket_types(event_id);
CREATE INDEX favorites_event_id_idx ON favorites(event_id);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER promoters_updated_at BEFORE UPDATE ON promoters FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER ticket_types_updated_at BEFORE UPDATE ON ticket_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();

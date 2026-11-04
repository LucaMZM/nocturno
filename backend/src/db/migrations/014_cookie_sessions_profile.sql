-- Additive migration: no commerce data or existing migrations are changed.
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD CONSTRAINT users_avatar_url_check CHECK (
  avatar_url IS NULL OR (length(avatar_url) <= 2048 AND avatar_url ~ '^https://[^[:space:]]+$')
);
CREATE TABLE revoked_access_tokens (
  jti UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT CHECK (length(reason) <= 120)
);
CREATE INDEX revoked_access_tokens_expiry_idx ON revoked_access_tokens(expires_at);
CREATE INDEX revoked_access_tokens_user_idx ON revoked_access_tokens(user_id);

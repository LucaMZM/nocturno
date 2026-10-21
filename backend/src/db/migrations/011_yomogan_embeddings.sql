-- A small public catalogue does not require a separate vector server.
CREATE TABLE yomogan_embeddings (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  model_key CHAR(64) NOT NULL,
  document_hash CHAR(64) NOT NULL,
  embedding JSONB NOT NULL CHECK (jsonb_typeof(embedding)='array'
    AND jsonb_array_length(embedding) BETWEEN 1 AND 4096),
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id,model_key)
);

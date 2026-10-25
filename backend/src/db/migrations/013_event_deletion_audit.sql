-- Immutable identifiers are snapshots: physical deletion must not erase its audit trail.
CREATE TABLE event_deletion_audit (
  request_id UUID PRIMARY KEY,
  actor_id UUID NOT NULL,
  actor_role VARCHAR(20) NOT NULL CHECK (actor_role IN ('ADMIN','PROMOTER')),
  event_id UUID NOT NULL,
  operation VARCHAR(10) NOT NULL CHECK (operation IN ('delete','archive')),
  analysis_hash CHAR(64) NOT NULL,
  impact JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX event_deletion_audit_event_idx ON event_deletion_audit(event_id, occurred_at DESC);
CREATE INDEX event_deletion_audit_actor_idx ON event_deletion_audit(actor_id, occurred_at DESC);

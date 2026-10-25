-- Preserve all existing records: NOT VALID checks/FKs enforce subsequent writes
-- while db:audit reports pre-existing violations for explicit human remediation.
-- Composite keys prevent individually valid IDs being combined across events.
ALTER TABLE ticket_types ADD CONSTRAINT ticket_types_id_event_unique UNIQUE (id, event_id);
ALTER TABLE order_items ADD CONSTRAINT order_items_id_event_type_unique
  UNIQUE (id, event_id, ticket_type_id);
ALTER TABLE order_items ADD CONSTRAINT order_items_ticket_type_event_fk
  FOREIGN KEY (ticket_type_id, event_id) REFERENCES ticket_types(id, event_id)
  ON DELETE RESTRICT NOT VALID;
ALTER TABLE tickets ADD CONSTRAINT tickets_order_item_event_type_fk
  FOREIGN KEY (order_item_id, event_id, ticket_type_id)
  REFERENCES order_items(id, event_id, ticket_type_id) ON DELETE RESTRICT NOT VALID;

-- NUMERIC arithmetic avoids BIGINT overflow before comparing the stored cents.
ALTER TABLE order_items ADD CONSTRAINT order_items_subtotal_matches_quantity
  CHECK (subtotal_cents::numeric = unit_price_cents::numeric * quantity) NOT VALID;
ALTER TABLE orders ADD CONSTRAINT orders_currency_format
  CHECK (currency ~ '^[A-Z]{3}$') NOT VALID;
ALTER TABLE payments ADD CONSTRAINT payments_currency_format
  CHECK (currency ~ '^[A-Z]{3}$') NOT VALID;

-- PostgreSQL does not automatically index referencing columns of foreign keys.
CREATE INDEX order_items_ticket_type_id_idx ON order_items(ticket_type_id);
CREATE INDEX tickets_order_item_id_idx ON tickets(order_item_id);
CREATE INDEX tickets_ticket_type_id_idx ON tickets(ticket_type_id);
CREATE INDEX event_waitlist_user_id_idx ON event_waitlist(user_id);

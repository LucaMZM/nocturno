import test from 'node:test';
import assert from 'node:assert/strict';
import { ticketQuantityLimit, ticketSubtotalCents } from '../src/app/shared/utils/ticketing.ts';
import { statusLabel, statusTone } from '../src/app/shared/utils/status-presentation.ts';

test('quantity and price use bounded units and integer cents', () => {
  assert.equal(ticketQuantityLimit(3, 6), 3);
  assert.equal(ticketQuantityLimit(20, 2), 2);
  assert.equal(ticketQuantityLimit(0, 6), 0);
  assert.equal(ticketSubtotalCents(22, 3), 6600);
  assert.equal(ticketSubtotalCents(15, 2) + ticketSubtotalCents(22, 1), 5200);
  assert.equal(ticketSubtotalCents(12.5, 3), 3750);
});

test('management status presentation separates inactive, deleted and publication', () => {
  assert.equal(statusTone('ACTIVE'), 'positive');
  assert.equal(statusTone('INACTIVE'), 'danger');
  assert.equal(statusTone('DELETED'), 'danger');
  assert.equal(statusTone('PUBLISHED'), 'positive');
  assert.equal(statusTone('DRAFT'), 'warning');
  assert.equal(statusTone('FAILED'), 'danger');
  assert.equal(statusTone('VALID'), 'positive');
  assert.equal(statusTone('USED'), 'muted');
  assert.notEqual(statusLabel('DELETED'), statusLabel('INACTIVE'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessRole } from '../src/app/features/auth/role-access.ts';

const user = { id: 'fixture', role: 'USER' };
const promoter = { id: 'fixture', role: 'PROMOTER' };
const admin = { id: 'fixture', role: 'ADMIN' };

test('role guard decision denies anonymous and USER from management', () => {
  assert.equal(canAccessRole(null, ['PROMOTER', 'ADMIN']), false);
  assert.equal(canAccessRole(user, ['PROMOTER', 'ADMIN']), false);
  assert.equal(canAccessRole(promoter, ['PROMOTER', 'ADMIN']), true);
  assert.equal(canAccessRole(admin, ['PROMOTER', 'ADMIN']), true);
  assert.equal(canAccessRole(promoter, ['ADMIN']), false);
});

import { getPool } from '../config/db.js';

// Fixed SQL definitions only. Locks serialize deletes with new FK references and
// stock changes, so dependency checks cannot race with checkout or ownership.
const policies = {
  venue: {
    table: 'venues',
    dependencies: `SELECT count(*)::int AS events FROM events WHERE venue_id = $1`,
  },
  promoter: {
    table: 'promoters',
    dependencies: `SELECT (SELECT count(*)::int FROM events WHERE promoter_id = $1) AS events,
      (SELECT count(*)::int FROM users WHERE promoter_id = $1) AS users`,
  },
  user: {
    table: 'users',
    dependencies: `SELECT (SELECT count(*)::int FROM orders WHERE user_id = $1) AS orders,
      (SELECT count(*)::int FROM tickets WHERE user_id = $1) AS tickets`,
  },
  ticketType: {
    table: 'ticket_types',
    dependencies: `SELECT (SELECT count(*)::int FROM order_items WHERE ticket_type_id = $1) AS order_items,
      (SELECT count(*)::int FROM tickets WHERE ticket_type_id = $1) AS tickets,
      sold, reserved FROM ticket_types WHERE id = $1`,
  },
};

async function removeUnreferenced(policy, id) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(`SELECT id FROM ${policy.table} WHERE id = $1 FOR UPDATE`, [id]);
    if (!locked.rowCount) {
      await client.query('COMMIT');
      return { found: false, deleted: false, dependencies: {} };
    }
    const { rows: [dependencies] } = await client.query(policy.dependencies, [id]);
    const blocked = Object.values(dependencies).some((count) => count > 0);
    if (!blocked) await client.query(`DELETE FROM ${policy.table} WHERE id = $1`, [id]);
    await client.query('COMMIT');
    return { found: true, deleted: !blocked, dependencies };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export const entityRemovalRepository = {
  removeVenue: (id) => removeUnreferenced(policies.venue, id),
  removePromoter: (id) => removeUnreferenced(policies.promoter, id),
  removeUser: (id) => removeUnreferenced(policies.user, id),
  removeTicketType: (id) => removeUnreferenced(policies.ticketType, id),
};

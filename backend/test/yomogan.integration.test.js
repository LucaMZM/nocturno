import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';
import { yomoganRepository } from '../src/repositories/yomogan.repository.js';
test(
  'Yomogan SQL checks publication, stock, locality, dates and actual sellable price',
  { skip: !env.DATABASE_URL },
  async () => {
    const pool = getPool(),
      venue = randomUUID(),
      ids = [];
    try {
      await pool.query(
        "INSERT INTO venues(id,name,slug,type,province,municipality,address) VALUES($1,'Yomogan fixture',$2,'CLUB','Fixture','YomoganCity','Fixture')",
        [venue, 'yomogan-' + venue],
      );
      for (const kind of [
        'visible',
        'inactive',
        'deleted',
        'cancelled',
        'draft',
        'finished',
        'past',
        'sold',
        'future-sale',
        'expired-sale',
      ]) {
        const id = randomUUID();
        ids.push(id);
        const status =
          { cancelled: 'CANCELLED', draft: 'DRAFT', finished: 'FINISHED' }[kind] ?? 'PUBLISHED';
        await pool.query(
          'INSERT INTO events(id,venue_id,title,slug,event_type,starts_at,ends_at,status,is_active,deleted_at,music_genres) ' +
            "VALUES($1,$2,$3,$4,'CLUB',NOW()+($5||' days')::interval,NOW()+($6||' days')::interval,$7,$8,$9,ARRAY['TECHNO'])",
          [
            id,
            venue,
            kind,
            'yomogan-' + id,
            kind === 'past' ? -2 : 2,
            kind === 'past' ? -1 : 3,
            status,
            !['inactive', 'deleted'].includes(kind),
            kind === 'deleted' ? new Date() : null,
          ],
        );
        await pool.query(
          "INSERT INTO ticket_types(event_id,name,price,quantity,sold,sales_start,sales_end) VALUES($1,'General',14,10,$2,$3,$4)",
          [
            id,
            kind === 'sold' ? 10 : 0,
            kind === 'future-sale' ? new Date(Date.now() + 86400000) : null,
            kind === 'expired-sale' ? new Date(Date.now() - 86400000) : null,
          ],
        );
      }
      // An exhausted cheap tier must not make this event appear under a lower budget.
      await pool.query(
        "INSERT INTO ticket_types(event_id,name,price,quantity,sold) VALUES($1,'Exhausted cheap',1,1,1)",
        [ids[0]],
      );
      const filters = {
        municipality: 'YomoganCity',
        genre: 'TECHNO',
        maxPrice: 20,
        exclusivePrice: true,
        dateFrom: new Date().toISOString(),
        groupSize: 4,
      };
      assert.deepEqual(
        (await yomoganRepository.candidates(filters)).map((e) => e.id),
        [ids[0]],
      );
      assert.equal((await yomoganRepository.candidates({ ...filters, maxPrice: 10 })).length, 0);
      assert.equal(
        (await yomoganRepository.candidates({ ...filters, municipality: 'Elsewhere' })).length,
        0,
      );
      assert.equal((await yomoganRepository.candidates({ ...filters, genre: 'HOUSE' })).length, 0);
      assert.equal(
        (await yomoganRepository.candidates({ ...filters, dateTo: new Date().toISOString() }))
          .length,
        0,
      );
      assert.equal((await yomoganRepository.candidates({ ...filters, maxPrice: 14 })).length, 0);
      assert.equal(
        (await yomoganRepository.candidates({ ...filters, maxPrice: 14, exclusivePrice: false }))
          .length,
        1,
      );
      await yomoganRepository.cache(ids[0], 'a'.repeat(64), 'b'.repeat(64), [1, 0]);
      assert.equal((await yomoganRepository.cached([ids[0]], 'a'.repeat(64))).length, 1);
    } finally {
      await pool.query('DELETE FROM ticket_types WHERE event_id=ANY($1::uuid[])', [ids]);
      await pool.query('DELETE FROM events WHERE venue_id=$1', [venue]);
      await pool.query('DELETE FROM venues WHERE id=$1', [venue]);
      await closePool();
    }
  },
);

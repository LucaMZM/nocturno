import { fileURLToPath } from 'node:url';
import { getPool, closePool } from '../config/db.js';
import { env } from '../config/env.js';
import { runIntegrityAudit } from '../services/integrity-audit.service.js';
import { catalogueEvents } from './catalogue-expansion.js';

// Insert-only: a known UUID (including an archived event) is never rewritten.
export async function importCatalogue(pool = getPool()) {
  if (env.NODE_ENV === 'production') throw new Error('Sample catalogue import is disabled in production');
  const report = await runIntegrityAudit(pool);
  if (report.errors) throw new Error(`Import cancelled: integrity audit reports ${report.errors} errors. No data changed.`);
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(1313877845)');
    for (const [index, event] of catalogueEvents.entries()) {
      const eventId = `f1000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      if ((await client.query('SELECT 1 FROM events WHERE id=$1', [eventId])).rowCount) continue;
      const venue = (await client.query('SELECT id FROM venues WHERE slug=$1', [event.venueSlug])).rows[0];
      if (!venue) throw new Error(`Required existing venue missing: ${event.venueSlug}. Nothing imported.`);
      const start = `((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date + $9::integer + $10::time) AT TIME ZONE 'Europe/Madrid'`;
      await client.query(`INSERT INTO events(id,venue_id,title,slug,description,event_type,music_genres,atmosphere,
        starts_at,ends_at,minimum_age,dress_code,ideal_for,poster_url,image_source_url,status,is_active,is_demo)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,${start},(${start})+interval '4 hours',18,'CASUAL',
          ARRAY['FRIENDS','DANCING'],$11,$12,'PUBLISHED',TRUE,TRUE)`,
      [eventId, venue.id, event.title, event.slug, event.description, event.type, event.genres, event.atmosphere,
        event.dayOffset, event.hour, event.images[0].url, event.images[0].source]);
      for (const [position, image] of event.images.entries()) {
        await client.query(`INSERT INTO event_images(event_id,url,position,alt_text,source_url,origin)
          VALUES($1,$2,$3,$4,$5,'SEED')`, [eventId, image.url, position, image.alt, image.source]);
      }
      for (const [tier, increment, stock] of [['Anticipada', 0, 30], ['General', 4, 70]]) {
        await client.query(`INSERT INTO ticket_types(event_id,name,price,quantity,max_per_user,benefits)
          VALUES($1,$2,$3,$4,6,ARRAY['Acceso a la propuesta de Nocturno · entrada no oficial'])`,
        [eventId, tier, event.price + increment, stock]);
      }
      inserted++;
    }
    await client.query('COMMIT');
    return { inserted, skipped: catalogueEvents.length - inserted };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    // Read-only preflight BEFORE creating a backup or making any insert.
    const report = await runIntegrityAudit(getPool());
    if (report.errors) throw new Error(`Import cancelled: ${report.errors} integrity errors. Run npm run db:audit. No data changed.`);
    const { backupCatalogueDatabase } = await import('../../tools/backup-catalogue.js');
    await backupCatalogueDatabase();
    console.log(await importCatalogue());
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await closePool(); }
}

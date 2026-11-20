import { createHmac, randomBytes } from 'node:crypto';
import { eventViewsRepository } from '../repositories/event-views.repository.js';
import { AppError } from '../utils/AppError.js';

// Dedupe efímero de un día; nunca se escribe la IP ni su huella en PostgreSQL.
const secret = randomBytes(32), seen = new Map(), rates = new Map();
let day = '';
export const eventViewsService = {
  async record(slug, { ip, agent, purpose }) {
    if (!agent || /bot|crawler|spider|headless/i.test(agent) || /prefetch|prerender/i.test(purpose ?? '')) return false;
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
    if (today !== day) { seen.clear(); rates.clear(); day = today; }
    const client = createHmac('sha256', secret).update(today + ip).digest('hex');
    const key = client + ':' + slug;
    if (seen.has(key)) return false;
    const now = Date.now(), rate = rates.get(client);
    if ((rate && rate.until > now && rate.count >= 30) || seen.size >= 100000)
      throw new AppError(429, 'VIEW_RATE_LIMIT', 'Demasiadas solicitudes');
    rates.set(client, { until: rate?.until > now ? rate.until : now + 60000,
      count: rate?.until > now ? rate.count + 1 : 1 });
    seen.set(key, true);
    try { return await eventViewsRepository.record(slug); }
    catch (error) { seen.delete(key); throw error; }
  },
  ranking(actor, days) {
    if (actor.role !== 'ADMIN' && !actor.promoterId) throw new AppError(403, 'FORBIDDEN', 'Sin promotor asociado');
    return eventViewsRepository.ranking(actor, days);
  },
};

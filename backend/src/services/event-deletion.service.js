import { createHash, randomUUID } from 'node:crypto';
import { getPool } from '../config/db.js';
import { eventDeletionRepository as repository } from '../repositories/event-deletion.repository.js';
import { AppError } from '../utils/AppError.js';

function authorize(actor, event) {
  if (!actor || !['ADMIN', 'PROMOTER'].includes(actor.role) ||
    (actor.role === 'PROMOTER' && (!actor.promoterId || actor.promoterId !== event.promoter_id)))
    throw new AppError(403, 'FORBIDDEN', 'No puedes gestionar este evento.');
}

export function eventDeletionImpact(snapshot, actor, forceArchive = false) {
  const { event, counts, fingerprints, integrity } = snapshot;
  authorize(actor, event);
  const blockers = [];
  if (event.deleted_at) blockers.push('El evento ya está archivado. Primero debes restaurarlo.');
  if (integrity.stock_mismatch) blockers.push('El stock vendido o reservado no coincide con los pedidos. Revisa la auditoría de integridad.');
  if (integrity.cross_mismatch) blockers.push('Existen relaciones cruzadas incoherentes entre evento, pedido y entrada.');
  const commerce = counts.orderItems > 0 || counts.tickets > 0 || counts.payments > 0;
  const operation = blockers.length ? 'blocked' : commerce || forceArchive ? 'archive' : 'delete';
  const archive = operation === 'archive';
  const labels = {
    ticketTypes: 'Tipos de entrada', activeTicketTypes: 'Tipos de entrada actualmente activos', orderItems: 'Líneas de pedido', orders: 'Pedidos',
    payments: 'Pagos', tickets: 'Entradas emitidas', favorites: 'Favoritos',
    cartItems: 'Elementos de carrito', waitlist: 'Inscripciones en lista de espera',
    images: 'Imágenes del evento', embeddings: 'Embeddings de Yomogan',
  };
  const history = ['orders', 'orderItems', 'payments', 'tickets'];
  const impact = {
    eventId: event.id, title: event.title, operation, recoverable: archive,
    relations: Object.entries(counts).filter(([key]) => key !== 'activeTicketTypes' || archive).map(([key, count]) => ({
      key, label: labels[key], count,
      action: operation === 'blocked' ? 'preserve' : history.includes(key) ? 'preserve'
        : !archive || ['cartItems', 'embeddings'].includes(key) ? 'delete'
          : key === 'activeTicketTypes' ? 'deactivate' : 'preserve',
      reason: history.includes(key) ? 'El historial comercial no se elimina.'
        : key === 'cartItems' ? 'No se podrá iniciar una nueva compra de este evento.'
          : key === 'embeddings' ? 'Son datos derivados; se regeneran si vuelve al catálogo.'
            : archive ? 'Se conserva la relación; el evento queda fuera del catálogo público.'
              : 'Dependencia sin historial comercial, eliminada por su clave foránea.',
    })),
    blockers,
    warnings: commerce ? ['La actividad comercial impide el borrado físico. Se conservarán pedidos, pagos, entradas y snapshots. Las reservas existentes siguen su ciclo normal; no se anulan entradas ni se hacen reembolsos.'] : [],
  };
  impact.analysisToken = createHash('sha256').update(JSON.stringify({ actor: actor.id, event, counts, fingerprints, integrity, operation })).digest('hex');
  return impact;
}

function replay(row, actor, eventId, input) {
  if (!row) return null;
  if (row.actor_id !== actor.id || row.event_id !== eventId || row.operation !== input.operation || row.analysis_hash !== input.analysisToken)
    throw new AppError(409, 'DELETION_REQUEST_CONFLICT', 'La solicitud ya corresponde a otra operación.');
  return { eventId, operation: row.operation, replayed: true };
}

export const eventDeletionService = {
  async preview(eventId, actor) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const snapshot = await repository.snapshot(client, eventId);
      if (!snapshot) throw new AppError(404, 'EVENT_NOT_FOUND', 'Evento no encontrado.');
      const impact = eventDeletionImpact(snapshot, actor);
      await client.query('COMMIT');
      return impact;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  },
  async execute(eventId, actor, input, { legacyArchive = false } = {}) {
    if (!actor || !['ADMIN', 'PROMOTER'].includes(actor.role)) throw new AppError(403, 'FORBIDDEN', 'Operación no permitida.');
    const client = await getPool().connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      const previous = await repository.findRequest(input.requestId, client);
      if (previous) {
        const result = replay(previous, actor, eventId, input);
        await client.query('COMMIT');
        return result;
      }
      const snapshot = await repository.snapshot(client, eventId, true);
      if (!snapshot) throw new AppError(404, 'EVENT_NOT_FOUND', 'Evento no encontrado.');
      const impact = eventDeletionImpact(snapshot, actor, legacyArchive);
      if (impact.operation === 'blocked') throw new AppError(409, 'EVENT_DELETION_BLOCKED', impact.blockers.join(' '));
      if (!legacyArchive && (impact.analysisToken !== input.analysisToken || impact.operation !== input.operation))
        throw new AppError(409, 'IMPACT_STALE', 'Las dependencias han cambiado. Actualiza el análisis antes de continuar.');
      if (impact.operation === 'archive') await repository.archive(client, eventId);
      else await repository.remove(client, eventId);
      await repository.record(client, actor, input.requestId, impact);
      await client.query('COMMIT');
      return { eventId, operation: impact.operation, replayed: false };
    } catch (error) {
      await client.query('ROLLBACK');
      if (['40001', '40P01', '23505'].includes(error.code)) {
        const existing = await repository.findRequest(input.requestId, client);
        const result = replay(existing, actor, eventId, input);
        if (result) return result;
        throw new AppError(409, 'IMPACT_STALE', 'Otra operación ha cambiado el evento. Actualiza el análisis.');
      }
      if (error.code === '23503') throw new AppError(409, 'EVENT_DELETION_BLOCKED', 'Han aparecido relaciones que impiden el borrado. Actualiza el análisis.');
      throw error;
    } finally { client.release(); }
  },
  // Older clients retain archive-only semantics; they can never request physical deletion.
  async archiveLegacy(eventId, actor) {
    const input = { requestId: randomUUID(), operation: 'archive' };
    // Legacy intent is always archive, with no client snapshot. Re-evaluate transient
    // serialization conflicts; the token-confirmed physical-delete flow never auto-retries.
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await eventDeletionService.execute(eventId, actor, input, { legacyArchive: true }); }
      catch (error) { if (error.code !== 'IMPACT_STALE' || attempt === 2) throw error; }
    }
  },
};

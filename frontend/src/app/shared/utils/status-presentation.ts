export type StatusTone = 'positive' | 'warning' | 'danger' | 'muted' | 'neutral';

const labels: Record<string, string> = {
  DRAFT: 'Borrador', PENDING_REVIEW: 'En revisión', PUBLISHED: 'Publicado',
  SOLD_OUT: 'Agotado', CANCELLED: 'Cancelado', FINISHED: 'Finalizado',
  REJECTED: 'Rechazado', ACTIVE: 'Activo', INACTIVE: 'Inactivo', DELETED: 'Borrado',
  AWAITING_PAYMENT: 'Pendiente de pago', PENDING: 'Pendiente', PAID: 'Pagado',
  FAILED: 'Fallido', EXPIRED: 'Caducado', REFUNDED: 'Reembolsado',
  VALID: 'Válida', USED: 'Usada', USER: 'Usuario', PROMOTER: 'Promotor', ADMIN: 'Admin',
};

export function statusLabel(status: string): string { return labels[status] ?? status; }

export function statusTone(status: string): StatusTone {
  if (['PUBLISHED', 'ACTIVE', 'PAID', 'VALID'].includes(status)) return 'positive';
  if (['DRAFT', 'PENDING_REVIEW', 'SOLD_OUT', 'AWAITING_PAYMENT', 'PENDING'].includes(status)) return 'warning';
  if (['INACTIVE', 'DELETED', 'CANCELLED', 'REJECTED', 'FAILED', 'REFUNDED'].includes(status)) return 'danger';
  if (['FINISHED', 'EXPIRED', 'USED'].includes(status)) return 'muted';
  return 'neutral';
}

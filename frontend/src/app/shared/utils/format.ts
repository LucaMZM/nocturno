const dateFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const fullDateFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const priceFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

export function eventDate(value: string): string { return dateFormatter.format(new Date(value)); }
export function fullEventDate(value: string): string { return fullDateFormatter.format(new Date(value)); }
export function eventTime(value: string): string { return timeFormatter.format(new Date(value)); }
export function euro(value: number): string { return priceFormatter.format(value); }
export function readableTag(value: string): string { return value.replaceAll('_', ' ').toLocaleLowerCase('es-ES'); }
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m`
    : `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(km)} km`;
}

export type DatePreset = 'tonight' | 'tomorrow' | 'weekend';
export function dateRangeFor(preset: DatePreset, now = new Date()): { dateFrom: string; dateTo: string } {
  const start = new Date(now);
  if (preset === 'tomorrow') start.setDate(start.getDate() + 1);
  if (preset === 'weekend') {
    const day = start.getDay();
    const daysUntilFriday = day === 0 ? -2 : day === 6 ? -1 : (5 - day + 7) % 7;
    start.setDate(start.getDate() + daysUntilFriday);
  }
  start.setHours(18, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + (preset === 'weekend' ? 3 : 1));
  end.setHours(6, 0, 0, 0);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

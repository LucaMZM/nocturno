export const managementDefaults = {
  search: '', status: '', active: 'all', deleted: 'exclude', promoterId: '', venueId: '',
  municipality: '', dateFrom: '', dateTo: '', period: 'all', sort: 'recent',
  view: 'table', month: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).format(new Date()),
  page: '1',
};
export type ManagementFilters = typeof managementDefaults;
const choices: Partial<Record<keyof ManagementFilters, string[]>> = {
  status: ['', 'DRAFT','PENDING_REVIEW','PUBLISHED','SOLD_OUT','CANCELLED','FINISHED','REJECTED'],
  active: ['all','true','false'], deleted: ['exclude','only'],
  sort: ['dateAsc','dateDesc','titleAsc','titleDesc','recent','sold','views'],
  period: ['all','upcoming','past','custom'], view: ['table','grid','calendar'],
};
export function parseManagementFilters(params: { get(key: string): string | null }, admin: boolean): ManagementFilters {
  const result = { ...managementDefaults };
  for (const key of Object.keys(result) as (keyof ManagementFilters)[]) {
    const value = params.get(key);
    if (value !== null && value.length <= 160 && (!choices[key] || choices[key]!.includes(value))) result[key] = value;
  }
  for (const key of ['promoterId','venueId'] as const)
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(result[key])) result[key] = '';
  for (const key of ['dateFrom','dateTo'] as const)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result[key]) || !Number.isFinite(Date.parse(result[key]))) result[key] = '';
  if (!/^\d{4}-(0[1-9]|1[012])$/.test(result.month)) result.month = managementDefaults.month;
  if (!/^[1-9]\d{0,5}$/.test(result.page)) result.page = '1';
  if (!admin) result.deleted = 'exclude';
  if (result.deleted === 'only') result.active = 'all';
  if (result.dateFrom && result.dateTo && result.dateFrom > result.dateTo) result.dateTo = '';
  return result;
}
export function managementChips(filters: ManagementFilters) {
  const labels: Partial<Record<keyof ManagementFilters,string>> = {
    search:'Búsqueda',status:'Estado',active:'Actividad',deleted:'Papelera',promoterId:'Promotor',
    venueId:'Local',municipality:'Ciudad',dateFrom:'Desde',dateTo:'Hasta',period:'Periodo',
  };
  return (Object.keys(labels) as (keyof ManagementFilters)[])
    .filter(key => filters[key] !== managementDefaults[key] && !(key === 'period' && filters[key] === 'custom'))
    .map(key => ({ key, label: labels[key]!, value: filters[key] }));
}
// Medianoche civil de Madrid: obtiene el offset real también durante cambios de horario.
export function madridMidnight(date: string): Date {
  const utc = Date.parse(date + 'T00:00:00Z');
  const zone = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', timeZoneName: 'longOffset' })
    .formatToParts(new Date(utc)).find(part => part.type === 'timeZoneName')!.value;
  const match = zone.match(/GMT([+-])(\d{2}):(\d{2})/)!;
  const minutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '+' ? 1 : -1);
  return new Date(utc - minutes * 60000);
}
export function monthDays(month: string): string[] {
  const [year, number] = month.split('-').map(Number);
  return Array.from({ length: new Date(Date.UTC(year, number, 0)).getUTCDate() },
    (_, index) => month + '-' + String(index + 1).padStart(2, '0'));
}
export function nextDay(date: string): string {
  return new Date(Date.parse(date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
}
export function managementQuery(filters: ManagementFilters, now = new Date()): Record<string,string> {
  const result: Record<string,string> = { page: filters.page, limit: '20', sort: filters.sort,
    active: filters.active, deleted: filters.deleted };
  for (const key of ['search','status','promoterId','venueId','municipality'] as const)
    if (filters[key]) result[key] = filters[key];
  if (filters.period === 'upcoming') result['dateFrom'] = now.toISOString();
  if (filters.period === 'past') result['dateTo'] = now.toISOString();
  if (filters.dateFrom) result['dateFrom'] = madridMidnight(filters.dateFrom).toISOString();
  if (filters.dateTo) result['dateTo'] = new Date(madridMidnight(nextDay(filters.dateTo)).getTime()-1).toISOString();
  if (filters.view === 'calendar') {
    const days = monthDays(filters.month);
    const start = madridMidnight(days[0]).toISOString();
    const end = new Date(madridMidnight(nextDay(days.at(-1)!)).getTime()-1).toISOString();
    result['dateFrom'] = result['dateFrom'] && result['dateFrom'] > start ? result['dateFrom'] : start;
    result['dateTo'] = result['dateTo'] && result['dateTo'] < end ? result['dateTo'] : end;
    result['limit'] = '100';
  }
  return result;
}

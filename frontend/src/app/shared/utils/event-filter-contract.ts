import type { EventFilters } from '../../core/models/domain.model';

/**
 * Converts EventFilters to and from Router query params and labels applied filters.
 * This is the single URL contract used by the Events list and browser history.
 */
// Keep these values aligned with backend/src/validators/event.validator.js.
export const EVENT_GENRES = [
  'TECHNO',
  'HARD_TECHNO',
  'HARDGROOVE',
  'HOUSE',
  'TECH_HOUSE',
  'EDM',
  'REGGAETON',
  'LATIN',
  'HIP_HOP',
  'TRAP',
  'POP',
  'INDIE',
  'ROCK',
  'JAZZ',
  'SOUL',
  'LIVE',
] as const;
export const EVENT_TYPES = [
  'CLUB',
  'RAVE',
  'CONCERT',
  'FESTIVAL',
  'ROOFTOP',
  'BEACH_CLUB',
  'BOAT_PARTY',
  'PUB',
  'AFTER',
  'JAZZ_CLUB',
  'LIVE_SESSION',
  'OTHER',
] as const;
export const EVENT_STATUSES = ['PUBLISHED', 'SOLD_OUT'] as const;
export const EVENT_ATMOSPHERES = ['UNDERGROUND','COMMERCIAL','UNIVERSITY','ELEGANT','INTERNATIONAL','ALTERNATIVE','CHILL'] as const;
export const EVENT_DRESS_CODES = ['CASUAL','SMART_CASUAL','ELEGANT','STREETWEAR','NO_DRESS_CODE'] as const;
export const EVENT_IDEALS = ['FRIENDS','MEETING_PEOPLE','DANCING','DATE','GROUPS','CELEBRATIONS','DRINKS'] as const;
export const DEFAULT_EVENT_MUNICIPALITY = 'Valencia';
// The public API returns published and sold-out events when no status is requested.
export const DEFAULT_EVENT_STATUS = undefined;
export const DEFAULT_EVENT_PAGE = 1;
export const DEFAULT_EVENT_LIMIT = 12;
export const DEFAULT_EVENT_FILTERS: EventFilters = {
  municipality: DEFAULT_EVENT_MUNICIPALITY,
  status: DEFAULT_EVENT_STATUS,
  page: DEFAULT_EVENT_PAGE,
  limit: DEFAULT_EVENT_LIMIT,
  sort: 'date',
};

const validChoice = (value: string | null, options: readonly string[]): string | undefined =>
  value && options.includes(value) ? value : undefined;
const validText = (value: string | null, maxLength: number): string | undefined => {
  const text = value?.trim();
  return text && text.length <= maxLength ? text : undefined;
};
const validNumber = (value: string | null): number | undefined => {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};
const validDate = (value: string | null): string | undefined =>
  value && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && !Number.isNaN(Date.parse(value))
    ? value
    : undefined;

export function parseEventFilters(params: Pick<URLSearchParams, 'get'>): EventFilters {
  const rawMunicipality = validText(params.get('municipality'), 120);
  const municipality =
    rawMunicipality === 'all' ? undefined : (rawMunicipality ?? DEFAULT_EVENT_FILTERS.municipality);
  const minPrice = validNumber(params.get('minPrice'));
  const maxPrice = validNumber(params.get('maxPrice'));
  const dateFrom = validDate(params.get('dateFrom'));
  const dateTo = validDate(params.get('dateTo'));
  const page = validNumber(params.get('page'));
  return {
    municipality,
    province: validText(params.get('province'), 120),
    genre: validChoice(params.get('genre'), EVENT_GENRES),
    atmosphere: validChoice(params.get('atmosphere'), EVENT_ATMOSPHERES),
    eventType: validChoice(params.get('eventType'), EVENT_TYPES),
    idealFor: validChoice(params.get('idealFor'), EVENT_IDEALS),
    venueId: validText(params.get('venueId'), 36),
    promoterId: validText(params.get('promoterId'), 36),
    dressCode: validChoice(params.get('dressCode'), EVENT_DRESS_CODES),
    status: validChoice(params.get('status'), EVENT_STATUSES),
    dateFrom,
    dateTo: dateFrom && dateTo && Date.parse(dateFrom) > Date.parse(dateTo) ? undefined : dateTo,
    minPrice,
    maxPrice:
      minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice
        ? undefined
        : maxPrice,
    minimumAge: Number.isInteger(validNumber(params.get('minimumAge')))
      ? validNumber(params.get('minimumAge'))
      : undefined,
    search: validText(params.get('search'), 160),
    radiusKm: ([2, 5, 10, 25, 50] as const).find((radius) => radius === validNumber(params.get('radiusKm'))),
    page: page && Number.isInteger(page) ? page : DEFAULT_EVENT_PAGE,
    limit: DEFAULT_EVENT_LIMIT,
    sort:
      params.get('sort') === 'price' || params.get('sort') === 'createdAt' || params.get('sort') === 'distance'
        ? (params.get('sort') as EventFilters['sort'])
        : 'date',
  };
}

export function serializeEventFilters(filters: EventFilters): Record<string, string> {
  const result: Record<string, string> = { municipality: filters.municipality || 'all' };
  for (const key of [
    'province',
    'genre',
    'atmosphere',
    'eventType',
    'idealFor',
    'venueId',
    'promoterId',
    'dressCode',
    'dateFrom',
    'dateTo',
    'minPrice',
    'maxPrice',
    'minimumAge',
    'search',
    'radiusKm',
  ] as const) {
    const value = filters[key];
    if (value !== undefined && value !== null && value !== '') result[key] = String(value);
  }
  if (filters.status) result['status'] = filters.status;
  if (filters.sort !== 'date') result['sort'] = filters.sort;
  if (filters.page > DEFAULT_EVENT_PAGE) result['page'] = String(filters.page);
  return result;
}

export function sameEventFilters(a: EventFilters, b: EventFilters): boolean {
  return JSON.stringify(serializeEventFilters(a)) === JSON.stringify(serializeEventFilters(b));
}

export type ActiveFilterKey = keyof EventFilters | 'date';
export interface ActiveFilterChip {
  key: ActiveFilterKey;
  label: string;
}

/** Describes active filters for the removable chips shown above the results. */
export function activeFilterChips(filters: EventFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (filters.municipality) chips.push({ key: 'municipality', label: filters.municipality });
  if (filters.province) chips.push({ key: 'province', label: filters.province });
  if (filters.genre) chips.push({ key: 'genre', label: filters.genre.replaceAll('_', ' ') });
  if (filters.atmosphere) chips.push({ key: 'atmosphere', label: filters.atmosphere.replaceAll('_', ' ') });
  if (filters.eventType)
    chips.push({ key: 'eventType', label: filters.eventType.replaceAll('_', ' ') });
  if (filters.idealFor) chips.push({ key: 'idealFor', label: filters.idealFor.replaceAll('_', ' ') });
  if (filters.dressCode)
    chips.push({ key: 'dressCode', label: filters.dressCode.replaceAll('_', ' ') });
  if (filters.dateFrom || filters.dateTo) chips.push({ key: 'date', label: 'Fecha seleccionada' });
  if (filters.minPrice !== undefined)
    chips.push({ key: 'minPrice', label: `Desde ${filters.minPrice} €` });
  if (filters.maxPrice !== undefined)
    chips.push({ key: 'maxPrice', label: `Hasta ${filters.maxPrice} €` });
  if (filters.minimumAge !== undefined)
    chips.push({ key: 'minimumAge', label: `Edad ${filters.minimumAge} años` });
  if (filters.search) chips.push({ key: 'search', label: `“${filters.search}”` });
  if (filters.radiusKm) chips.push({ key: 'radiusKm', label: `A ${filters.radiusKm} km` });
  if (filters.status && filters.status !== DEFAULT_EVENT_STATUS)
    chips.push({ key: 'status', label: filters.status.replaceAll('_', ' ') });
  if (filters.sort !== 'date')
    chips.push({ key: 'sort', label: filters.sort === 'price' ? 'Menor precio' : filters.sort === 'distance' ? 'Más cerca' : 'Recientes' });
  return chips;
}

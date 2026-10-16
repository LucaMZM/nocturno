import type { EventFilters } from '../../core/models/domain.model';

export function eventFilterEntries(filters: EventFilters): [string, string][] {
  return Object.entries(filters)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== null && entry[1] !== '')
    .map(([key, value]) => [key, String(value)]);
}

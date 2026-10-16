import { toCamel } from '../utils/mapping.js';
export function mapVenue(row) {
  const venue = toCamel(row);
  if (venue) for (const key of ['latitude', 'longitude']) if (venue[key] != null) venue[key] = Number(venue[key]);
  return venue;
}

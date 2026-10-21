import { toCamel } from '../utils/mapping.js';
export function mapEvent(row) {
  const event = toCamel(row);
  if (event) event.images ??= [];
  if (event && 'minPrice' in event) event.minPrice = event.minPrice == null ? null : Number(event.minPrice);
  if (event && 'ticketAvailability' in event) event.ticketAvailability = Number(event.ticketAvailability);
  if (event && 'distanceKm' in event) event.distanceKm = event.distanceKm == null ? null : Number(event.distanceKm);
  if (event && 'venueLatitude' in event) event.venueLatitude = event.venueLatitude == null ? null : Number(event.venueLatitude);
  if (event && 'venueLongitude' in event) event.venueLongitude = event.venueLongitude == null ? null : Number(event.venueLongitude);
  return event;
}

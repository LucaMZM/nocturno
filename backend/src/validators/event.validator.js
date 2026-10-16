import { z } from 'zod';
import { id, optionalText, pageQuery, patch } from './common.js';
export const eventTypes = ['CLUB','RAVE','CONCERT','FESTIVAL','ROOFTOP','BEACH_CLUB','BOAT_PARTY','PUB','AFTER','JAZZ_CLUB','LIVE_SESSION','OTHER'];
export const statuses = ['DRAFT','PENDING_REVIEW','PUBLISHED','SOLD_OUT','CANCELLED','FINISHED','REJECTED'];
export const genres = ['TECHNO','HARD_TECHNO','HARDGROOVE','HOUSE','TECH_HOUSE','EDM','REGGAETON','LATIN','HIP_HOP','TRAP','POP','INDIE','ROCK','JAZZ','SOUL','LIVE'];
export const atmospheres = ['UNDERGROUND','COMMERCIAL','UNIVERSITY','ELEGANT','INTERNATIONAL','ALTERNATIVE','CHILL'];
export const ideals = ['FRIENDS','MEETING_PEOPLE','DANCING','DATE','GROUPS','CELEBRATIONS','DRINKS'];
const date = z.iso.datetime({ offset: true });
export const eventCreate = z.object({
  venueId: id, promoterId: id.nullable().optional(), title: z.string().trim().min(1).max(180),
  description: optionalText,
  eventType: z.enum(eventTypes), startsAt: date, endsAt: date, minimumAge: z.number().int().min(0).nullable().optional(),
  dressCode: z.enum(['CASUAL','SMART_CASUAL','ELEGANT','STREETWEAR','NO_DRESS_CODE']).nullable().optional(),
  musicGenres: z.array(z.enum(genres)).max(30).default([]), atmosphere: z.array(z.enum(atmospheres)).max(20).default([]),
  idealFor: z.array(z.enum(ideals)).max(20).default([]),
  posterUrl: z.union([z.url(), z.string().regex(/^\/posters\/[a-z0-9-]+\.svg$/)]).nullable().optional(),
  sourceUrl: z.url().nullable().optional(), imageSourceUrl: z.url().nullable().optional(),
  status: z.enum(statuses).default('DRAFT'), isActive: z.boolean().default(true)
}).strict();
export const eventPatch = patch(eventCreate);
export const eventActive = z.object({ isActive: z.boolean() }).strict();
export const eventSlug = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200) }).strict();
export const eventQuery = z.object({
  ...pageQuery, municipality: z.string().trim().min(1).max(120).optional(), province: z.string().trim().min(1).max(120).optional(),
  genre: z.enum(genres).optional(), atmosphere: z.enum(atmospheres).optional(), eventType: z.enum(eventTypes).optional(), status: z.enum(statuses).optional(),
  idealFor: z.enum(ideals).optional(), venueId: id.optional(), promoterId: id.optional(),
  dressCode: z.enum(['CASUAL','SMART_CASUAL','ELEGANT','STREETWEAR','NO_DRESS_CODE']).optional(),
  dateFrom: date.optional(), dateTo: date.optional(), minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(), minimumAge: z.coerce.number().int().min(0).optional(),
  search: z.string().trim().min(1).max(160).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().refine((value) => [2, 5, 10, 25, 50].includes(value), 'Invalid radius').optional(),
  sort: z.enum(['date','price','createdAt','distance']).default('date')
}).strict().refine((v) => !v.dateFrom || !v.dateTo || new Date(v.dateFrom) <= new Date(v.dateTo), 'dateFrom must be before dateTo')
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, 'minPrice must be <= maxPrice')
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), 'latitude and longitude must be provided together')
  .refine((v) => v.radiusKm === undefined || v.latitude !== undefined, 'radiusKm requires coordinates')
  .refine((v) => v.sort !== 'distance' || v.latitude !== undefined, 'distance sort requires coordinates');

import { z } from 'zod';
import { optionalText, optionalUrl, patch } from './common.js';
export const venueTypes = ['CLUB','DISCOTHEQUE','BAR','PUB','ROOFTOP','BEACH_CLUB','CONCERT_HALL','FESTIVAL_SITE','OUTDOOR','OTHER'];
export const venueCreate = z.object({
  name: z.string().trim().min(1).max(160), description: optionalText, type: z.enum(venueTypes),
  province: z.string().trim().min(1).max(120), municipality: z.string().trim().min(1).max(120),
  zone: z.string().trim().max(120).nullable().optional(), address: z.string().trim().min(1).max(240),
  postalCode: z.string().regex(/^[0-9]{5}$/).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(),
  capacity: z.number().int().min(0).nullable().optional(), minimumAge: z.number().int().min(0).nullable().optional(),
  websiteUrl: optionalUrl, imageUrl: optionalUrl
}).strict();
export const venuePatch = patch(venueCreate);

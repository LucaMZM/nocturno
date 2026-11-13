export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'PROMOTER' | 'ADMIN';
  isActive: boolean;
  promoterId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Promoter {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  province: string;
  municipality: string;
  zone: string | null;
  address: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  minimumAge: number | null;
  websiteUrl: string | null;
  imageUrl: string | null;
  sourceUrl?: string | null;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  venueId: string;
  promoterId: string | null;
  title: string;
  slug: string;
  description: string | null;
  eventType: string;
  startsAt: string;
  endsAt: string;
  minimumAge: number | null;
  dressCode: string | null;
  musicGenres: string[];
  atmosphere: string[];
  idealFor: string[];
  posterUrl: string | null;
  images: EventImage[];
  sourceUrl?: string | null;
  imageSourceUrl?: string | null;
  isDemo?: boolean;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  venueName?: string;
  venueSlug?: string;
  promoterName?: string | null;
  promoterSlug?: string | null;
  municipality?: string;
  province?: string;
  venueLatitude?: number | null;
  venueLongitude?: number | null;
  distanceKm?: number | null;
  minPrice?: number | null;
  ticketAvailability?: number;
  favoritedAt?: string;
}

export interface EventImage {
  id: string;
  url: string;
  position: number;
  altText: string | null;
  sourceUrl: string | null;
}

export interface EventImageInput {
  url: string;
  altText?: string | null;
  sourceUrl?: string | null;
}

export interface EventWritePayload {
  venueId: string;
  promoterId: string | null;
  title: string;
  description: string | null;
  eventType: string;
  startsAt: string;
  endsAt: string;
  minimumAge: number | null;
  dressCode: string | null;
  musicGenres: string[];
  atmosphere: string[];
  idealFor: string[];
  posterUrl: string | null;
  images?: EventImageInput[];
  status: string;
  isActive: boolean;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  reserved: number;
  salesStart: string | null;
  salesEnd: string | null;
  maxPerUser: number | null;
  benefits: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Favorite {
  userId: string;
  eventId: string;
  createdAt: string;
}

export interface EventFilters {
  municipality?: string;
  province?: string;
  genre?: string;
  atmosphere?: string;
  eventType?: string;
  idealFor?: string;
  venueId?: string;
  promoterId?: string;
  dressCode?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  minPrice?: number;
  maxPrice?: number;
  minimumAge?: number;
  search?: string;
  radiusKm?: 2 | 5 | 10 | 25 | 50;
  page: number;
  limit: number;
  sort: 'date' | 'price' | 'createdAt' | 'distance';
}

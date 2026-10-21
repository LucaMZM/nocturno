import type { EventImageInput, EventWritePayload } from '../../../core/models/domain.model';

export interface EventFormValues {
  title: string; eventType: string; venueId: string; promoterId: string;
  startsAt: string; endsAt: string; status: string; isActive: boolean;
  minimumAge: string; description: string; dressCode: string;
  musicGenres: string[]; atmosphere: string[]; idealFor: string[];
}

export function isSafeEventImageUrl(value: string): boolean {
  if (/^\/posters\/[a-z0-9-]+\.svg$/.test(value)) return true;
  return isHttpUrl(value);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !/\s/.test(value);
  } catch {
    return false;
  }
}

export function prepareEventImages(draft: EventImageInput[], maxImages: number) {
  const images = draft.map((image) => ({
    url: image.url.trim(),
    altText: image.altText?.trim() || null,
    sourceUrl: image.sourceUrl?.trim() || null,
  })).filter((image) => image.url !== '');
  if (images.length > maxImages) {
    return { images: [], error: `Puedes añadir como máximo ${maxImages} imágenes.` };
  }
  if (images.some((image) => !isSafeEventImageUrl(image.url) ||
    (image.sourceUrl && !isHttpUrl(image.sourceUrl)))) {
    return { images: [], error: 'Usa URLs HTTP/HTTPS válidas o carteles locales de /posters/.' };
  }
  if (new Set(images.map((image) => image.url)).size !== images.length) {
    return { images: [], error: 'No repitas la misma imagen en la galería.' };
  }
  return { images, error: null };
}

export function mapEventFormToPayload(
  values: EventFormValues, images: EventImageInput[],
): EventWritePayload {
  return {
    venueId: values.venueId,
    promoterId: values.promoterId || null,
    title: values.title.trim(),
    description: values.description.trim() || null,
    eventType: values.eventType,
    startsAt: new Date(values.startsAt).toISOString(),
    endsAt: new Date(values.endsAt).toISOString(),
    minimumAge: values.minimumAge === '' ? null : Number(values.minimumAge),
    dressCode: values.dressCode || null,
    musicGenres: values.musicGenres,
    atmosphere: values.atmosphere,
    idealFor: values.idealFor,
    posterUrl: images[0]?.url ?? null,
    images,
    status: values.status,
    isActive: values.isActive,
  };
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api.model';
import { Event, EventFilters, EventWritePayload } from '../../../core/models/domain.model';
import { eventFilterEntries } from '../../../shared/utils/event-filter-entries';
import { LocationStore } from '../../location/store/location.store';

export interface EventDeletionImpact {
  eventId: string;
  title: string;
  analysisToken: string;
  operation: 'delete' | 'archive' | 'blocked';
  recoverable: boolean;
  relations: { key: string; label: string; count: number; action: 'delete' | 'deactivate' | 'preserve' | 'block'; reason: string }[];
  blockers: string[];
  warnings: string[];
}

export interface EventDeletionResult {
  eventId: string;
  operation: 'delete' | 'archive';
  deletedAt?: string;
  replayed?: boolean;
}

export function eventFiltersToHttpParams(eventFilters: EventFilters): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of eventFilterEntries(eventFilters)) {
    params = params.set(key, value);
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class EventsApiService {
  private readonly http = inject(HttpClient);
  private readonly location = inject(LocationStore);

  // The store and map both call this public endpoint with their current filters.
  async getEvents(eventFilters: EventFilters): Promise<PaginatedResponse<Event>> {
    const latitude = this.location.latitude();
    const longitude = this.location.longitude();
    const hasAutomaticLocation =
      this.location.mode() === 'automatic' && latitude !== null && longitude !== null;
    let params = eventFiltersToHttpParams({
      ...eventFilters,
      radiusKm: hasAutomaticLocation ? eventFilters.radiusKm : undefined,
      sort: !hasAutomaticLocation && eventFilters.sort === 'distance' ? 'date' : eventFilters.sort,
    });
    if (hasAutomaticLocation) {
      params = params.set('latitude', latitude).set('longitude', longitude);
    }
    return firstValueFrom(
      this.http.get<PaginatedResponse<Event>>(`${environment.apiUrl}/events`, {
        params,
      }),
    );
  }

  getGalleryConfig(): Promise<ApiResponse<{ maxImages: number }>> {
    return firstValueFrom(this.http.get<ApiResponse<{ maxImages: number }>>(
      `${environment.apiUrl}/config/events`,
    ));
  }

  async getEventBySlug(eventSlug: string): Promise<ApiResponse<Event>> {
    return firstValueFrom(
      this.http.get<ApiResponse<Event>>(
        `${environment.apiUrl}/events/slug/${encodeURIComponent(eventSlug)}`,
      ),
    );
  }

  async getEventById(eventId: string): Promise<ApiResponse<Event>> {
    return firstValueFrom(
      this.http.get<ApiResponse<Event>>(
        `${environment.apiUrl}/events/${encodeURIComponent(eventId)}`,
      ),
    );
  }

  async createEvent(payload: EventWritePayload): Promise<ApiResponse<Event>> {
    return firstValueFrom(
      this.http.post<ApiResponse<Event>>(`${environment.apiUrl}/events`, payload),
    );
  }

  async updateEvent(eventId: string, payload: Partial<EventWritePayload>): Promise<ApiResponse<Event>> {
    return firstValueFrom(
      this.http.patch<ApiResponse<Event>>(
        `${environment.apiUrl}/events/${encodeURIComponent(eventId)}`,
        payload,
      ),
    );
  }
  getDeletionImpact(eventId: string): Promise<ApiResponse<EventDeletionImpact>> {
    return firstValueFrom(this.http.get<ApiResponse<EventDeletionImpact>>(
      `${environment.apiUrl}/events/${encodeURIComponent(eventId)}/deletion-impact`));
  }

  deleteWithImpact(eventId: string, payload: {
    analysisToken: string; operation: 'delete' | 'archive'; requestId: string;
  }): Promise<ApiResponse<EventDeletionResult>> {
    return firstValueFrom(this.http.post<ApiResponse<EventDeletionResult>>(
      `${environment.apiUrl}/events/${encodeURIComponent(eventId)}/deletion`, payload));
  }

  async softDeleteEvent(eventId: string): Promise<ApiResponse<Event>> {
    return firstValueFrom(this.http.patch<ApiResponse<Event>>(
      `${environment.apiUrl}/events/${encodeURIComponent(eventId)}/soft-delete`, {}));
  }
  async restoreEvent(eventId: string): Promise<ApiResponse<Event>> {
    return firstValueFrom(this.http.patch<ApiResponse<Event>>(
      `${environment.apiUrl}/events/${encodeURIComponent(eventId)}/restore`, {}));
  }
  async setEventActive(eventId: string, isActive: boolean): Promise<ApiResponse<Event>> {
    return firstValueFrom(this.http.patch<ApiResponse<Event>>(
      `${environment.apiUrl}/events/${encodeURIComponent(eventId)}/active`, { isActive }));
  }
  getWaitlistStatus(eventId: string): Promise<ApiResponse<{ joined: boolean }>> {
    return firstValueFrom(this.http.get<ApiResponse<{ joined: boolean }>>(
      `${environment.apiUrl}/events/${encodeURIComponent(eventId)}/waitlist`));
  }
  joinWaitlist(eventId: string): Promise<ApiResponse<{ joined: boolean; createdAt: string }>> {
    return firstValueFrom(this.http.post<ApiResponse<{ joined: boolean; createdAt: string }>>(
      `${environment.apiUrl}/events/${encodeURIComponent(eventId)}/waitlist`, {}));
  }
}

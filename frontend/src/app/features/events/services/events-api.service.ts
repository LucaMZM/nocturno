import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api.model';
import { Event, EventFilters, EventWritePayload } from '../../../core/models/domain.model';
import { eventFilterEntries } from '../../../shared/utils/event-filter-entries';
import { LocationStore } from '../../location/store/location.store';

export function eventFiltersToHttpParams(eventFilters: EventFilters): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of eventFilterEntries(eventFilters)) params = params.set(key, value);
  return params;
}

@Injectable({ providedIn: 'root' })
export class EventsApiService {
  private readonly http = inject(HttpClient);
  private readonly location = inject(LocationStore);

  async getEvents(eventFilters: EventFilters): Promise<PaginatedResponse<Event>> {
    const hasLocation = this.location.mode() === 'automatic' && this.location.latitude() !== null && this.location.longitude() !== null;
    let params = eventFiltersToHttpParams({
      ...eventFilters,
      radiusKm: hasLocation ? eventFilters.radiusKm : undefined,
      sort: !hasLocation && eventFilters.sort === 'distance' ? 'date' : eventFilters.sort,
    });
    if (hasLocation) params = params.set('latitude', this.location.latitude()!).set('longitude', this.location.longitude()!);
    return firstValueFrom(
      this.http.get<PaginatedResponse<Event>>(`${environment.apiUrl}/events`, {
        params,
      }),
    );
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

  async updateEvent(eventId: string, payload: EventWritePayload): Promise<ApiResponse<Event>> {
    return firstValueFrom(
      this.http.patch<ApiResponse<Event>>(
        `${environment.apiUrl}/events/${encodeURIComponent(eventId)}`,
        payload,
      ),
    );
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

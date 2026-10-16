import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../models/api.model';
import { Event, Venue } from '../models/domain.model';

export interface PublicVenueProfile { venue: Venue; upcomingEvents: Event[]; upcomingTotal: number; }

@Injectable({ providedIn: 'root' })
export class VenuesApiService {
  private readonly http = inject(HttpClient);

  async getVenues(page = 1, limit = 100): Promise<PaginatedResponse<Venue>> {
    return firstValueFrom(this.http.get<PaginatedResponse<Venue>>(`${environment.apiUrl}/venues`, { params: new HttpParams().set('page', page).set('limit', limit) }));
  }

  async getVenue(id: string): Promise<ApiResponse<Venue>> {
    return firstValueFrom(this.http.get<ApiResponse<Venue>>(`${environment.apiUrl}/venues/${encodeURIComponent(id)}`));
  }
  getPublicProfile(slug: string): Promise<ApiResponse<PublicVenueProfile>> {
    return firstValueFrom(this.http.get<ApiResponse<PublicVenueProfile>>(
      `${environment.apiUrl}/venues/slug/${encodeURIComponent(slug)}`));
  }
  createVenue(payload: object): Promise<ApiResponse<Venue>> {
    return firstValueFrom(this.http.post<ApiResponse<Venue>>(`${environment.apiUrl}/venues`, payload));
  }
  updateVenue(id: string, payload: object): Promise<ApiResponse<Venue>> {
    return firstValueFrom(this.http.patch<ApiResponse<Venue>>(`${environment.apiUrl}/venues/${encodeURIComponent(id)}`, payload));
  }
  removeVenue(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${environment.apiUrl}/venues/${encodeURIComponent(id)}`));
  }
}

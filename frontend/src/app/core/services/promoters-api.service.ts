import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../models/api.model';
import { Event, Promoter } from '../models/domain.model';

export interface PublicPromoterProfile { promoter: Promoter; upcomingEvents: Event[]; upcomingTotal: number; }

@Injectable({ providedIn: 'root' })
export class PromotersApiService {
  private readonly http = inject(HttpClient);
  async getPromoters(page = 1, limit = 100): Promise<PaginatedResponse<Promoter>> {
    return firstValueFrom(
      this.http.get<PaginatedResponse<Promoter>>(`${environment.apiUrl}/promoters`, {
        params: { page, limit },
      }),
    );
  }
  async getPromoter(id: string): Promise<ApiResponse<Promoter>> {
    return firstValueFrom(
      this.http.get<ApiResponse<Promoter>>(
        `${environment.apiUrl}/promoters/${encodeURIComponent(id)}`,
      ),
    );
  }
  getPublicProfile(slug: string): Promise<ApiResponse<PublicPromoterProfile>> {
    return firstValueFrom(this.http.get<ApiResponse<PublicPromoterProfile>>(
      `${environment.apiUrl}/promoters/slug/${encodeURIComponent(slug)}`));
  }
  createPromoter(payload: object): Promise<ApiResponse<Promoter>> {
    return firstValueFrom(this.http.post<ApiResponse<Promoter>>(`${environment.apiUrl}/promoters`, payload));
  }
  updatePromoter(id: string, payload: object): Promise<ApiResponse<Promoter>> {
    return firstValueFrom(this.http.patch<ApiResponse<Promoter>>(`${environment.apiUrl}/promoters/${encodeURIComponent(id)}`, payload));
  }
  removePromoter(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${environment.apiUrl}/promoters/${encodeURIComponent(id)}`));
  }
}

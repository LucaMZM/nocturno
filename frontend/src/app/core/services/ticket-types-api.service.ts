import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../models/api.model';
import { ApiResponse } from '../models/api.model';
import { TicketType } from '../models/domain.model';

@Injectable({ providedIn: 'root' })
export class TicketTypesApiService {
  private readonly http = inject(HttpClient);
  async getByEvent(eventId: string, page = 1, limit = 100): Promise<PaginatedResponse<TicketType>> {
    return firstValueFrom(this.http.get<PaginatedResponse<TicketType>>(`${environment.apiUrl}/events/${encodeURIComponent(eventId)}/ticket-types`, {
      params: new HttpParams().set('page', page).set('limit', limit)
    }));
  }
  create(eventId: string, payload: object): Promise<ApiResponse<TicketType>> {
    return firstValueFrom(this.http.post<ApiResponse<TicketType>>(
      `${environment.apiUrl}/events/${encodeURIComponent(eventId)}/ticket-types`, payload));
  }
  update(id: string, payload: object): Promise<ApiResponse<TicketType>> {
    return firstValueFrom(this.http.patch<ApiResponse<TicketType>>(
      `${environment.apiUrl}/ticket-types/${encodeURIComponent(id)}`, payload));
  }
  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(
      `${environment.apiUrl}/ticket-types/${encodeURIComponent(id)}`));
  }
}

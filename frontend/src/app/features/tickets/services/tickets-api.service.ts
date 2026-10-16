import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api.model';
import { OwnedTicket } from '../../../core/models/commerce.model';
import { Attendee } from '../../dashboard/services/dashboard-api.service';

@Injectable({ providedIn: 'root' })
export class TicketsApiService {
  private readonly http = inject(HttpClient);
  private readonly root = `${environment.apiUrl}/tickets`;
  getTickets(page = 1): Promise<PaginatedResponse<OwnedTicket>> {
    return firstValueFrom(this.http.get<PaginatedResponse<OwnedTicket>>(this.root,
      { params: new HttpParams().set('page', page).set('limit', 20) }));
  }
  getTicket(ticketId: string): Promise<ApiResponse<OwnedTicket>> {
    return firstValueFrom(this.http.get<ApiResponse<OwnedTicket>>(`${this.root}/${encodeURIComponent(ticketId)}`));
  }
  checkIn(code: string, eventId: string): Promise<ApiResponse<Attendee>> {
    return firstValueFrom(this.http.post<ApiResponse<Attendee>>(
      `${this.root}/${encodeURIComponent(code)}/check-in`, { eventId }));
  }
}

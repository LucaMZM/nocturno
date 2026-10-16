import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api.model';
import { Event } from '../../../core/models/domain.model';

export interface DashboardSummary {
  events: number;
  upcomingEvents: number;
  activeEvents: number;
  soldOutEvents: number;
  ticketsSold: number;
  attendees: number;
  occupancyPercent: number;
  revenueCents: number;
  revenuePeriodCents: number;
  averageTicketCents: number;
  sales24h: number;
  sales7d: number;
  sales30d: number;
  orders: number;
  users: number;
  promoters: number;
  lowStock: { id: string; name: string; eventTitle: string; available: number }[];
  recentSales: Sale[];
  topEvents: TopEvent[];
  salesTrend: SalesDay[];
}

export interface TopEvent {
  id: string; title: string; venueName: string; ticketsSold: number; capacity: number;
  revenueCents: number; status: string; startsAt: string;
}
export interface SalesDay { day: string; revenueCents: number; tickets: number; }

export interface Sale {
  id: string;
  orderId: string;
  eventId: string;
  eventTitle: string;
  ticketTypeName: string;
  quantity: number;
  subtotalCents: number;
  createdAt: string;
  buyerName: string;
  paymentStatus: string | null;
}

export interface Attendee {
  id: string;
  code: string;
  status: string;
  issuedAt: string;
  usedAt: string | null;
  userId: string;
  displayName: string;
  email: string;
  ticketTypeName: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/dashboard`;

  getSummary() { return firstValueFrom(this.http.get<ApiResponse<DashboardSummary>>(this.base)); }
  getTopEvents(sort: 'revenue' | 'tickets' | 'date') {
    return firstValueFrom(this.http.get<ApiResponse<TopEvent[]>>(`${this.base}/top-events`, { params: { sort } }));
  }
  getEvents(page = 1, search = '', status = '', deleted: 'exclude' | 'only' = 'exclude', active: 'all' | 'true' | 'false' = 'all') {
    return firstValueFrom(this.http.get<PaginatedResponse<Event>>(`${this.base}/events`,
      { params: { page, limit: 20, deleted, active, ...(search ? { search } : {}), ...(status ? { status } : {}) } }));
  }
  getEventOptions() { return firstValueFrom(this.http.get<PaginatedResponse<Event>>(`${this.base}/events`,
    { params: { page: 1, limit: 100, deleted: 'exclude', active: 'all' } })); }
  getSales(page = 1, eventId?: string, search = '') {
    return firstValueFrom(this.http.get<PaginatedResponse<Sale>>(`${this.base}/sales`,
      { params: { page, limit: 20, ...(eventId ? { eventId } : {}), ...(search ? { search } : {}) } }));
  }
  getAttendees(eventId: string, page = 1, search = '') {
    return firstValueFrom(this.http.get<PaginatedResponse<Attendee>>(
      `${environment.apiUrl}/events/${encodeURIComponent(eventId)}/attendees`,
      { params: { page, limit: 20, ...(search ? { search } : {}) } }));
  }
  getCheckInOverview(eventId: string) {
    return firstValueFrom(this.http.get<ApiResponse<CheckInOverview>>(
      `${environment.apiUrl}/events/${encodeURIComponent(eventId)}/check-in`));
  }
}

export interface CheckInOverview {
  eventId: string; eventTitle: string; venueName: string; startsAt: string;
  capacity: number; issued: number; used: number; pending: number; rejected: number;
  recent: { id: string; displayName: string; ticketTypeName: string; usedAt: string }[];
}

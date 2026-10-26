import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api.model';
import { Order, OwnedTicket } from '../../../core/models/commerce.model';

export interface Payment {
  id: string; orderId: string; provider: string; providerPaymentId: string;
  status: string; amountCents: number; currency: string; createdAt: string;
  buyerName: string; orderStatus: string; refundRequestedAt: string | null; providerRefundId: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;
  getOrders(page = 1, search = '', status = '', eventId = '', dateFrom = '', dateTo = '') { return firstValueFrom(this.http.get<PaginatedResponse<Order>>(
    `${this.base}/orders`, { params: { page, limit: 20, ...(search ? { search } : {}), ...(status ? { status } : {}),
      ...(eventId ? { eventId } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) } })); }
  getPayments(page = 1, search = '', status = '', dateFrom = '', dateTo = '') { return firstValueFrom(this.http.get<PaginatedResponse<Payment>>(
    `${this.base}/payments`, { params: { page, limit: 20, ...(search ? { search } : {}), ...(status ? { status } : {}),
      ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) } })); }
  requestRefund(paymentId: string) { return firstValueFrom(this.http.post<ApiResponse<{ id: string; status: string; refundRequestedAt: string | null }>>(
    `${this.base}/payments/${encodeURIComponent(paymentId)}/refund`, {})); }
  getTickets(page = 1, search = '', status = '') { return firstValueFrom(this.http.get<PaginatedResponse<OwnedTicket>>(
    `${this.base}/tickets/admin/all`, { params: { page, limit: 20, ...(search ? { search } : {}), ...(status ? { status } : {}) } })); }
}

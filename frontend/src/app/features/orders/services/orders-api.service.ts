import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api.model';
import { Order } from '../../../core/models/commerce.model';

@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly root = `${environment.apiUrl}/orders`;
  getOrders(page = 1): Promise<PaginatedResponse<Order>> {
    return firstValueFrom(this.http.get<PaginatedResponse<Order>>(this.root,
      { params: new HttpParams().set('page', page).set('limit', 20) }));
  }
  getOrder(orderId: string): Promise<ApiResponse<Order>> {
    return firstValueFrom(this.http.get<ApiResponse<Order>>(`${this.root}/${encodeURIComponent(orderId)}`));
  }
}

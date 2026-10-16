import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { Cart } from '../../../core/models/commerce.model';

@Injectable({ providedIn: 'root' })
export class CartApiService {
  private readonly http = inject(HttpClient);
  private readonly root = `${environment.apiUrl}/cart`;

  getCart(): Promise<ApiResponse<Cart>> {
    return firstValueFrom(this.http.get<ApiResponse<Cart>>(this.root));
  }
  addItem(ticketTypeId: string, quantity: number): Promise<ApiResponse<Cart>> {
    return firstValueFrom(this.http.post<ApiResponse<Cart>>(`${this.root}/items`, { ticketTypeId, quantity }));
  }
  updateItem(itemId: string, quantity: number): Promise<ApiResponse<Cart>> {
    return firstValueFrom(this.http.patch<ApiResponse<Cart>>(`${this.root}/items/${encodeURIComponent(itemId)}`, { quantity }));
  }
  removeItem(itemId: string): Promise<ApiResponse<Cart>> {
    return firstValueFrom(this.http.delete<ApiResponse<Cart>>(`${this.root}/items/${encodeURIComponent(itemId)}`));
  }
  clear(): Promise<ApiResponse<Cart>> {
    return firstValueFrom(this.http.delete<ApiResponse<Cart>>(`${this.root}/items`));
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { CheckoutSession } from '../../../core/models/commerce.model';

export interface PaymentConfig { enabled: boolean; publishableKey: string | null; testMode: boolean; }

@Injectable({ providedIn: 'root' })
export class CheckoutApiService {
  private readonly http = inject(HttpClient);

  getPaymentConfig(): Promise<ApiResponse<PaymentConfig>> {
    return firstValueFrom(this.http.get<ApiResponse<PaymentConfig>>(`${environment.apiUrl}/config/payments`));
  }
  startCheckout(idempotencyKey: string): Promise<ApiResponse<CheckoutSession>> {
    return firstValueFrom(this.http.post<ApiResponse<CheckoutSession>>(
      `${environment.apiUrl}/checkout`, {}, { headers: { 'Idempotency-Key': idempotencyKey } }));
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { User } from '../../../core/models/domain.model';

export interface AuthSession { user: User; accessToken: string; }

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly root = `${environment.apiUrl}/auth`;

  login(email: string, password: string): Promise<ApiResponse<AuthSession>> {
    return firstValueFrom(this.http.post<ApiResponse<AuthSession>>(`${this.root}/login`,
      { email, password }, { withCredentials: true }));
  }
  register(email: string, password: string, displayName: string): Promise<ApiResponse<AuthSession>> {
    return firstValueFrom(this.http.post<ApiResponse<AuthSession>>(`${this.root}/register`,
      { email, password, displayName }, { withCredentials: true }));
  }
  refresh(): Promise<ApiResponse<AuthSession>> {
    return firstValueFrom(this.http.post<ApiResponse<AuthSession>>(`${this.root}/refresh`,
      {}, { withCredentials: true }));
  }
  async logout(): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.root}/logout`, {}, { withCredentials: true }));
  }
}

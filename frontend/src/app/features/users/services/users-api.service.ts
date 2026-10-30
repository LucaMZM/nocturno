import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api.model';
import { User } from '../../../core/models/domain.model';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;
  getUsers(page = 1, search = '', role = '') { return firstValueFrom(this.http.get<PaginatedResponse<User>>(
    `${this.base}/users`, { params: { page, limit: 20, ...(search ? { search } : {}), ...(role ? { role } : {}) } })); }
  createUser(payload: object) { return firstValueFrom(this.http.post<ApiResponse<User>>(`${this.base}/users`, payload)); }
  deleteUser(id: string) { return firstValueFrom(this.http.delete<void>(
    `${this.base}/users/${encodeURIComponent(id)}`)); }
  updateUser(id: string, payload: object) { return firstValueFrom(this.http.patch<ApiResponse<User>>(
    `${this.base}/users/${encodeURIComponent(id)}`, payload)); }
}

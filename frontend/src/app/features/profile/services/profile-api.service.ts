import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { User } from '../../../core/models/domain.model';

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly root = `${environment.apiUrl}/profile/me`;
  getMine(): Promise<ApiResponse<User>> { return firstValueFrom(this.http.get<ApiResponse<User>>(this.root)); }
  updateMine(displayName: string): Promise<ApiResponse<User>> {
    return firstValueFrom(this.http.patch<ApiResponse<User>>(this.root, { displayName }));
  }
}

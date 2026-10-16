import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../models/api.model';
import { Event, Favorite } from '../models/domain.model';

@Injectable({ providedIn: 'root' })
export class FavoritesApiService {
  private readonly http = inject(HttpClient);
  private readonly root = `${environment.apiUrl}/me/favorites`;

  async getFavorites(page = 1, limit = 100): Promise<PaginatedResponse<Event>> {
    return firstValueFrom(this.http.get<PaginatedResponse<Event>>(this.root, { params: new HttpParams().set('page', page).set('limit', limit) }));
  }

  async addFavorite(eventId: string): Promise<ApiResponse<Favorite>> {
    return firstValueFrom(this.http.post<ApiResponse<Favorite>>(`${this.root}/${encodeURIComponent(eventId)}`, {}));
  }

  async removeFavorite(eventId: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.root}/${encodeURIComponent(eventId)}`));
  }
}

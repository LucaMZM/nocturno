import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { EventFilters, TicketType } from '../../../core/models/domain.model';
import { EventsApiService } from '../../events/services/events-api.service';

export interface ShopEntry {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  municipality?: string;
  province?: string;
  imageUrl?: string;
}
export type ShopVariant = TicketType & { available: number; purchasable: boolean };

@Injectable({ providedIn: 'root' })
export class ShopApiService {
  private readonly http = inject(HttpClient);
  private readonly events = inject(EventsApiService);
  private collection(path: string) {
    return firstValueFrom(this.http.get<ApiResponse<ShopEntry[]>>(`${environment.apiUrl}/shop/${path}`));
  }
  getCategories() { return this.collection('categories'); }
  getHosts() { return this.collection('hosts'); }
  getLocations() { return this.collection('locations'); }
  getEvents(filters: EventFilters) { return this.events.observeEvents(filters); }
  getEventDetails(slug: string) { return this.events.getEventBySlug(slug); }
  getEventVariants(slug: string) {
    return firstValueFrom(this.http.get<ApiResponse<ShopVariant[]>>(
      `${environment.apiUrl}/shop/events/${encodeURIComponent(slug)}/variants`));
  }
}

import { Component, effect, inject, untracked } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { EventsStore } from './features/events/store/events.store';
import { LocationStore } from './features/location/store/location.store';
import { HeaderComponent } from './layout/header';
import { DEFAULT_EVENT_PAGE, serializeEventFilters } from './shared/utils/event-filter-contract';
import { AuthStore } from './features/auth/store/auth.store';
import { FavoritesStore } from './features/favorites/store/favorites.store';
import { CartStore } from './features/cart/store/cart.store';
import { OrdersStore } from './features/orders/store/orders.store';
import { TicketsStore } from './features/tickets/store/tickets.store';
import { YomoganChatComponent } from './features/yomogan/components/yomogan-chat.component';
import { YomoganStore } from './features/yomogan/store/yomogan.store';
import { CookiePreferencesComponent } from './features/cookies/components/cookie-preferences.component';
import { DashboardStore } from './features/dashboard/store/dashboard.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, CookiePreferencesComponent, YomoganChatComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly yomogan = inject(YomoganStore);
  readonly year = new Date().getFullYear();
  readonly location = inject(LocationStore);
  private readonly auth = inject(AuthStore);
  private readonly favorites = inject(FavoritesStore);
  private readonly cart = inject(CartStore);
  private readonly orders = inject(OrdersStore);
  private readonly tickets = inject(TicketsStore);
  private readonly dashboard = inject(DashboardStore);
  private readonly events = inject(EventsStore);
  private readonly router = inject(Router);

  constructor() {
    void this.yomogan.loadConfig();
    void this.location.loadMunicipalities();
    void this.auth.bootstrap();
    let previousUserId: string | undefined;
    effect(() => {
      const userId = this.auth.user()?.id;
      untracked(() => {
        if (userId === previousUserId) return;
        previousUserId = userId;
        this.favorites.reset();
        this.cart.reset();
        this.orders.reset();
        this.tickets.reset();
        this.dashboard.reset();
        if (userId) { void this.favorites.load(); void this.cart.load(); }
      });
    });
  }

  changeLocation(municipality: string) {
    this.location.clearNearMe();
    this.location.setMunicipality(municipality);
    void this.router.navigate(['/'], {
      queryParams: serializeEventFilters({
        ...this.events.filters(),
        municipality: municipality || undefined,
        radiusKm: undefined,
        sort: this.events.filters().sort === 'distance' ? 'date' : this.events.filters().sort,
        page: DEFAULT_EVENT_PAGE,
      }),
    });
  }
}

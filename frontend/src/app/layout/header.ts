import { Component, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LocationSelectorComponent } from '../shared/components/location-selector';
import { AuthStore } from '../features/auth/store/auth.store';
import { FavoritesStore } from '../features/favorites/store/favorites.store';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, LocationSelectorComponent],
  template: `
    <header class="site-header">
      <div class="header-inner page-width">
        <a class="wordmark" routerLink="/" aria-label="Nocturno, ir a descubrir"
          >NOCTURNO<span>.</span></a
        >
        <nav class="primary-nav" aria-label="Navegación principal">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
            >Descubrir</a
          >
          <a routerLink="/favorites" routerLinkActive="active">Favoritos</a>
          <a routerLink="/cart" routerLinkActive="active">Carrito</a>
        </nav>
        <div class="header-right">
          <app-location-selector
            [municipality]="municipality()"
            [municipalities]="municipalities()"
            (changed)="locationChanged.emit($event)"
          />
          @if (auth.user(); as user) {
            @if (user.role === 'ADMIN' || user.role === 'PROMOTER') {
              <a class="header-action" routerLink="/dashboard">Gestión</a>
            }
            <a class="header-action" routerLink="/account">Mi cuenta</a>
            <button class="header-action" type="button" (click)="logout()">Salir</button>
          } @else {
            <a class="header-action" routerLink="/auth/login">Entrar</a>
          }
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  readonly auth = inject(AuthStore);
  private readonly favorites = inject(FavoritesStore);
  private readonly router = inject(Router);
  readonly municipality = input.required<string>();
  readonly municipalities = input.required<string[]>();
  readonly locationChanged = output<string>();

  async logout() {
    try { await this.auth.logout(); }
    finally { this.favorites.reset(); await this.router.navigateByUrl('/'); }
  }
}

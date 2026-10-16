import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../auth/store/auth.store';

@Component({
  selector: 'app-account-layout-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="page-width account-layout">
      <aside class="account-sidebar">
        <p class="eyebrow">MI NOCTURNO</p>
        <h1>{{ auth.user()?.displayName }}</h1>
        <nav aria-label="Mi cuenta">
          <a routerLink="/account" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Perfil</a>
          <a routerLink="/account/favorites" routerLinkActive="active">Favoritos</a>
          <a routerLink="/account/orders" routerLinkActive="active">Mis pedidos</a>
          <a routerLink="/account/tickets" routerLinkActive="active">Mis entradas</a>
        </nav>
      </aside>
      <div class="account-content"><router-outlet /></div>
    </div>
  `,
})
export class AccountLayoutPage { readonly auth = inject(AuthStore); }

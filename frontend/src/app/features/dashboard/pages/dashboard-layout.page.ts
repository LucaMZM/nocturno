import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../auth/store/auth.store';

@Component({
  selector: 'app-dashboard-layout-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="dashboard-layout page-width">
      <aside class="dashboard-sidebar">
        <p class="eyebrow">NOCTURNO · GESTIÓN</p>
        <h1>{{ auth.user()?.role === 'ADMIN' ? 'Administración' : 'Promotor' }}</h1>
        <nav aria-label="Panel de gestión">
          <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Resumen</a>
          <a routerLink="/dashboard/events" routerLinkActive="active">Eventos</a>
          <a routerLink="/dashboard/sales" routerLinkActive="active">Ventas</a>
          @if (auth.user()?.role === 'ADMIN') {
            <a routerLink="/dashboard/users" routerLinkActive="active">Usuarios</a>
            <a routerLink="/dashboard/promoters" routerLinkActive="active">Promotores</a>
            <a routerLink="/dashboard/venues" routerLinkActive="active">Locales</a>
            <a routerLink="/dashboard/orders" routerLinkActive="active">Pedidos</a>
            <a routerLink="/dashboard/payments" routerLinkActive="active">Pagos</a>
            <a routerLink="/dashboard/tickets" routerLinkActive="active">Entradas</a>
          } @else {
            <a routerLink="/dashboard/profile" routerLinkActive="active">Perfil del promotor</a>
          }
        </nav>
      </aside>
      <main class="dashboard-main"><router-outlet /></main>
    </div>
  `,
})
export class DashboardLayoutPage { readonly auth = inject(AuthStore); }

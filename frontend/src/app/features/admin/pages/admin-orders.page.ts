import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminStore } from '../store/admin.store';
import { statusLabel, statusTone } from '../../../shared/utils/status-presentation';

@Component({
  selector: 'app-admin-orders-page',
  providers: [AdminStore], imports: [RouterLink, FormsModule],
  template: `
    <div class="dashboard-heading"><p class="eyebrow">COMERCIO</p><h2>Pedidos<span>.</span></h2></div>
    <form class="management-filters" (ngSubmit)="searchOrders()">
      <label>Buscar <input name="search" [(ngModel)]="query" placeholder="Pedido o comprador" /></label>
      <label>Estado <select name="status" [(ngModel)]="status"><option value="">Todos</option>
        <option value="AWAITING_PAYMENT">Pendiente</option><option value="PAID">Pagado</option>
        <option value="CANCELLED">Cancelado</option><option value="EXPIRED">Caducado</option>
        <option value="REFUNDED">Reembolsado</option></select></label>
      <label>Evento <select name="eventId" [(ngModel)]="eventId"><option value="">Todos los eventos</option>
        @for (event of store.eventOptions(); track event.id) { <option [value]="event.id">{{ event.title }}</option> }
      </select></label>
      <label>Desde <input type="date" name="dateFrom" [(ngModel)]="dateFrom" /></label>
      <label>Hasta <input type="date" name="dateTo" [(ngModel)]="dateTo" /></label>
      <button class="button-outline">Filtrar</button>
    </form>
    @if (store.loading()) { <p role="status">Cargando pedidos…</p> }
    @if (store.error()) { <p class="inline-alert" role="alert">{{ store.error() }}</p> }
    @if (!store.loading() && !store.error() && !store.orders().length) { <p class="muted">No hay pedidos con estos filtros.</p> }
    <div class="management-table-wrap"><table class="management-table"><thead><tr>
      <th>Pedido</th><th>Cliente</th><th>Evento</th><th>Entradas</th><th>Fecha</th><th>Estado</th><th>Pago</th><th>Total</th><th>Detalle</th>
    </tr></thead><tbody>
      @for (order of store.orders(); track order.id) { <tr>
        <td>{{ order.id.slice(-8) }}</td><td>{{ order.buyerName || order.userId.slice(-8) }}<small>{{ order.buyerEmail }}</small></td>
        <td>{{ order.eventTitles || '—' }}</td><td>{{ order.itemCount ?? '—' }}</td>
        <td>{{ date(order.createdAt) }}</td><td><span [class]="'state-badge state-' + tone(order.status)">{{ label(order.status) }}</span></td>
        <td>@if (order.paymentStatus) { <span [class]="'state-badge state-' + tone(order.paymentStatus)">{{ label(order.paymentStatus) }}</span> } @else { — }</td>
        <td>{{ euros(order.totalCents) }}</td>
        <td><a [routerLink]="['/dashboard/orders', order.id]">Ver</a></td>
      </tr> }
    </tbody></table></div>
    <div class="pagination-actions"><button class="button-outline" [disabled]="store.pagination().page <= 1" (click)="page(-1)">Anterior</button>
      <span>Página {{ store.pagination().page }} de {{ store.pagination().totalPages || 1 }}</span>
      <button class="button-outline" [disabled]="store.pagination().page >= store.pagination().totalPages" (click)="page(1)">Siguiente</button></div>
  `,
})
export class AdminOrdersPage implements OnInit {
  readonly store = inject(AdminStore);
  readonly label = statusLabel;
  readonly tone = statusTone;
  readonly query = signal('');
  readonly status = signal('');
  readonly eventId = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  ngOnInit() { void this.store.loadOrders(); void this.store.loadEventOptions(); }
  searchOrders() { this.load(1); }
  page(delta: number) { this.load(this.store.pagination().page + delta); }
  private load(page: number) {
    void this.store.loadOrders(page, this.query(), this.status(), this.eventId().trim(),
      this.dateFrom() ? new Date(`${this.dateFrom()}T00:00:00`).toISOString() : '',
      this.dateTo() ? new Date(`${this.dateTo()}T23:59:59`).toISOString() : '');
  }
  date(value: string) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
  euros(value: number) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value / 100); }
}

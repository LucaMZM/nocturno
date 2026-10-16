import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DashboardStore } from '../store/dashboard.store';

@Component({
  selector: 'app-dashboard-sales-page',
  imports: [FormsModule],
  template: `
    <div class="dashboard-heading"><p class="eyebrow">COMERCIO</p><h2>Ventas<span>.</span></h2></div>
    <form class="management-filters" (ngSubmit)="searchSales()">
      <label>Buscar <input name="search" [(ngModel)]="query" placeholder="Evento o comprador" /></label>
      <button class="button-outline">Filtrar</button>
    </form>
    @if (dashboard.loading()) { <p role="status">Cargando ventas…</p> }
    @if (dashboard.error()) { <p class="inline-alert" role="alert">{{ dashboard.error() }}</p> }
    @if (!dashboard.loading() && !dashboard.error() && !dashboard.sales().length) { <p class="muted">No hay ventas con estos filtros.</p> }
    <div class="management-table-wrap"><table class="management-table"><thead><tr>
      <th>Fecha</th><th>Evento</th><th>Entrada</th><th>Comprador</th><th>Unidades</th><th>Total</th><th>Pedido</th>
    </tr></thead><tbody>
      @for (sale of dashboard.sales(); track sale.id) { <tr>
        <td>{{ date(sale.createdAt) }}</td><td>{{ sale.eventTitle }}</td><td>{{ sale.ticketTypeName }}</td>
        <td>{{ sale.buyerName }}</td><td>{{ sale.quantity }}</td><td>{{ euros(sale.subtotalCents) }}</td>
        <td>{{ sale.orderId.slice(-8) }}</td>
      </tr> }
    </tbody></table></div>
    <div class="pagination-actions">
      <button class="button-outline" [disabled]="dashboard.pagination().page <= 1" (click)="page(-1)">Anterior</button>
      <span>Página {{ dashboard.pagination().page }} de {{ dashboard.pagination().totalPages || 1 }}</span>
      <button class="button-outline" [disabled]="dashboard.pagination().page >= dashboard.pagination().totalPages" (click)="page(1)">Siguiente</button>
    </div>
  `,
})
export class DashboardSalesPage implements OnInit {
  readonly dashboard = inject(DashboardStore);
  readonly eventId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? undefined;
  readonly query = signal('');
  ngOnInit() { void this.dashboard.loadSales(1, this.eventId); }
  searchSales() { void this.dashboard.loadSales(1, this.eventId, this.query()); }
  page(delta: number) { void this.dashboard.loadSales(this.dashboard.pagination().page + delta, this.eventId, this.query()); }
  date(value: string) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
  euros(cents: number) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100); }
}

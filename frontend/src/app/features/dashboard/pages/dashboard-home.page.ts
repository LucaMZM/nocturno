import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../auth/store/auth.store';
import { DashboardStore } from '../store/dashboard.store';
import { DashboardApiService, TopEvent } from '../services/dashboard-api.service';
import { toApiProblem } from '../../../shared/utils/api-error';
import { statusLabel, statusTone } from '../../../shared/utils/status-presentation';

@Component({
  selector: 'app-dashboard-home-page',
  imports: [RouterLink],
  template: `
    <div class="dashboard-heading"><p class="eyebrow">{{ auth.user()?.role === 'ADMIN' ? 'VISIÓN GLOBAL' : 'TUS EVENTOS' }}</p><h2>La noche en cifras<span>.</span></h2></div>
    @if (dashboard.loading()) { <p role="status">Cargando métricas…</p> }
    @if (dashboard.error()) { <p class="inline-alert" role="alert">{{ dashboard.error() }} <button type="button" (click)="dashboard.loadSummary()">Reintentar</button></p> }
    @if (dashboard.summary(); as summary) {
      <div class="metric-grid">
        <article><span>Ingresos totales</span><strong>{{ euros(summary.revenueCents) }}</strong></article>
        <article><span>Últimos 30 días</span><strong>{{ euros(summary.revenuePeriodCents) }}</strong></article>
        <article><span>Entradas vendidas</span><strong>{{ summary.ticketsSold }}</strong></article>
        <article><span>Asistentes registrados</span><strong>{{ summary.attendees }}</strong></article>
        <article><span>Ticket medio</span><strong>{{ euros(summary.averageTicketCents) }}</strong></article>
        <article><span>Ocupación</span><strong>{{ percent(summary.occupancyPercent) }}</strong></article>
      </div>
      <div class="dashboard-mini-kpis" aria-label="Actividad reciente">
        <span>{{ summary.sales24h }} líneas vendidas / 24 h</span><span>{{ summary.sales7d }} / 7 días</span>
        <span>{{ summary.sales30d }} / 30 días</span><span>{{ summary.activeEvents }} activos</span>
        <span>{{ summary.soldOutEvents }} agotados</span><span>{{ summary.upcomingEvents }} próximos</span>
        @if (auth.user()?.role === 'ADMIN') { <span>{{ summary.users }} usuarios</span><span>{{ summary.promoters }} promotores</span> }
      </div>
      <section class="dashboard-section">
        <div class="row-between"><div><p class="eyebrow">ÚLTIMOS 30 DÍAS</p><h3>Evolución de ventas</h3></div><span>{{ summary.orders }} pedidos</span></div>
        <div class="sales-chart" role="img" aria-label="Ingresos diarios de los últimos 30 días">
          @for (day of summary.salesTrend; track day.day) {
            <div class="sales-chart-day" [attr.title]="day.day + ': ' + euros(day.revenueCents) + ', ' + day.tickets + ' entradas'">
              <span [style.height.%]="barHeight(day.revenueCents, summary.salesTrend)"></span>
            </div>
          }
        </div>
        <p class="muted chart-caption">Cada barra representa un día. Los importes proceden de pedidos pagados.</p>
      </section>
      <section class="dashboard-section">
        <div class="row-between"><div><p class="eyebrow">RENDIMIENTO</p><h3>Top eventos</h3></div>
          <label class="sort-control">Ordenar <select #sort [value]="topSort()" (change)="changeTopSort(sort.value)">
            <option value="revenue">Ingresos</option><option value="tickets">Entradas</option><option value="date">Fecha próxima</option>
          </select></label></div>
        @if (topLoading()) { <p role="status">Cargando eventos…</p> }
        @if (topError()) { <p class="inline-alert" role="alert">{{ topError() }}</p> }
        @if (!topLoading() && !topEvents().length) { <p class="muted">Todavía no hay eventos para mostrar.</p> }
        @if (!topLoading() && topEvents().length) { <div class="management-table-wrap"><table class="management-table"><thead><tr><th>Evento</th><th>Local</th><th>Vendidas</th><th>Capacidad</th><th>Ingresos</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
          @for (item of topEvents(); track item.id) { <tr><td>{{ item.title }}</td><td>{{ item.venueName }}</td><td>{{ item.ticketsSold }}</td><td>{{ item.capacity }}</td><td>{{ euros(item.revenueCents) }}</td><td><span [class]="'state-badge state-' + tone(item.status)">{{ label(item.status) }}</span></td><td>{{ date(item.startsAt) }}</td></tr> }
        </tbody></table></div> }
      </section>
      <section class="dashboard-section">
        <div class="row-between"><h3>Ventas recientes</h3><a routerLink="/dashboard/sales">Ver todas ↗</a></div>
        @if (!summary.recentSales.length) { <p class="muted">Aún no hay ventas registradas.</p> }
        @else { <div class="management-table-wrap"><table class="management-table"><thead><tr><th>Comprador</th><th>Evento</th><th>Entrada</th><th>Unidades</th><th>Importe</th><th>Fecha</th><th>Pago</th></tr></thead><tbody>
          @for (sale of summary.recentSales; track sale.id) { <tr><td>{{ sale.buyerName }}</td><td>{{ sale.eventTitle }}</td><td>{{ sale.ticketTypeName }}</td><td>{{ sale.quantity }}</td><td>{{ euros(sale.subtotalCents) }}</td><td>{{ date(sale.createdAt) }}</td><td><span [class]="'state-badge state-' + tone(sale.paymentStatus ?? '')">{{ label(sale.paymentStatus ?? '—') }}</span></td></tr> }
        </tbody></table></div> }
      </section>
      <section class="dashboard-section"><h3>Alertas de stock</h3>
        @if (!summary.lowStock.length) { <p class="muted">No hay entradas con stock bajo.</p> }
        @for (item of summary.lowStock; track item.id) { <p class="dashboard-alert">{{ item.eventTitle }} · {{ item.name }}: {{ item.available }} disponibles</p> }
      </section>
      <a class="button-primary" routerLink="/dashboard/events">Gestionar eventos <span>↗</span></a>
    }
  `,
})
export class DashboardHomePage implements OnInit {
  readonly dashboard = inject(DashboardStore);
  readonly auth = inject(AuthStore);
  readonly label = statusLabel;
  readonly tone = statusTone;
  private readonly api = inject(DashboardApiService);
  readonly topSort = signal<'revenue' | 'tickets' | 'date'>('revenue');
  readonly topEvents = signal<TopEvent[]>([]);
  readonly topLoading = signal(false);
  readonly topError = signal<string | null>(null);
  ngOnInit() { void this.dashboard.loadSummary(); void this.loadTopEvents(); }
  changeTopSort(value: string) {
    if (value !== 'revenue' && value !== 'tickets' && value !== 'date') return;
    this.topSort.set(value); void this.loadTopEvents();
  }
  async loadTopEvents() {
    this.topLoading.set(true); this.topError.set(null);
    try { this.topEvents.set((await this.api.getTopEvents(this.topSort())).data); }
    catch (error) { this.topError.set(toApiProblem(error, 'No hemos podido cargar el ranking.').message); }
    finally { this.topLoading.set(false); }
  }
  barHeight(value: number, days: { revenueCents: number }[]) {
    const max = Math.max(1, ...days.map((day) => day.revenueCents));
    return value ? Math.max(5, Math.round(value / max * 100)) : 2;
  }
  euros(cents: number) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100); }
  percent(value: number) { return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)}%`; }
  date(value: string) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short' }).format(new Date(value)); }
}

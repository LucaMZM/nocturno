import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminStore } from '../store/admin.store';
import { statusLabel, statusTone } from '../../../shared/utils/status-presentation';

@Component({
  selector: 'app-admin-payments-page',
  providers: [AdminStore],
  imports: [FormsModule],
  template: `
    <div class="dashboard-heading"><p class="eyebrow">COMERCIO</p><h2>Pagos<span>.</span></h2></div>
    <form class="management-filters" (ngSubmit)="searchPayments()">
      <label>Buscar <input name="search" [(ngModel)]="query" placeholder="Pago o pedido" /></label>
      <label>Estado <select name="status" [(ngModel)]="status"><option value="">Todos</option>
        <option value="PENDING">Pendiente</option><option value="PAID">Pagado</option>
        <option value="FAILED">Fallido</option><option value="REFUNDED">Reembolsado</option></select></label>
      <label>Desde <input type="date" name="dateFrom" [(ngModel)]="dateFrom" /></label>
      <label>Hasta <input type="date" name="dateTo" [(ngModel)]="dateTo" /></label>
      <button class="button-outline">Filtrar</button>
    </form>
    @if (store.loading()) { <p role="status">Cargando pagos…</p> }
    @if (store.error()) { <p class="inline-alert" role="alert">{{ store.error() }}</p> }
    @if (!store.loading() && !store.error() && !store.payments().length) { <p class="muted">No hay pagos con estos filtros.</p> }
    <div class="management-table-wrap"><table class="management-table"><thead><tr>
      <th>Fecha</th><th>Cliente</th><th>Pedido</th><th>Proveedor / referencia</th><th>Estado</th><th>Importe</th><th>Acción</th>
    </tr></thead><tbody>
      @for (payment of store.payments(); track payment.id) { <tr>
        <td>{{ date(payment.createdAt) }}</td><td>{{ payment.buyerName }}</td><td>{{ payment.orderId.slice(-8) }}</td>
        <td>{{ payment.provider }}<small>{{ payment.providerPaymentId || 'Sin referencia' }}</small></td>
        <td><span [class]="'state-badge state-' + tone(payment.status)">{{ label(payment.status) }}</span>
          @if (payment.providerPaymentId?.startsWith('pi_demo_')) { <small>Registro de muestra · sin cobro</small> }
          @if (payment.refundRequestedAt && payment.status !== 'REFUNDED') { <small><span class="state-badge state-warning">Reembolso solicitado</span></small> }</td>
        <td>{{ euros(payment.amountCents) }} {{ payment.currency }}</td>
        <td>@if (payment.status === 'PAID' && payment.providerPaymentId && !payment.providerPaymentId.startsWith('pi_demo_') && !payment.refundRequestedAt) {
          <button type="button" class="text-action" [disabled]="store.saving()" (click)="refund(payment.id)">Reembolsar</button>
        }</td>
      </tr> }
    </tbody></table></div>
    <div class="pagination-actions"><button class="button-outline" [disabled]="store.pagination().page <= 1" (click)="page(-1)">Anterior</button>
      <span>Página {{ store.pagination().page }} de {{ store.pagination().totalPages || 1 }}</span>
      <button class="button-outline" [disabled]="store.pagination().page >= store.pagination().totalPages" (click)="page(1)">Siguiente</button></div>
  `,
})
export class AdminPaymentsPage implements OnInit {
  readonly store = inject(AdminStore);
  readonly label = statusLabel;
  readonly tone = statusTone;
  readonly query = signal('');
  readonly status = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  ngOnInit() { void this.store.loadPayments(); }
  searchPayments() { this.load(1); }
  page(delta: number) { this.load(this.store.pagination().page + delta); }
  async refund(id: string) {
    if (!confirm('¿Solicitar el reembolso completo de este pago? Stripe confirmará el estado por webhook.')) return;
    if (await this.store.requestRefund(id)) this.load(this.store.pagination().page);
  }
  private load(page: number) {
    void this.store.loadPayments(page, this.query(), this.status(),
      this.dateFrom() ? new Date(`${this.dateFrom()}T00:00:00`).toISOString() : '',
      this.dateTo() ? new Date(`${this.dateTo()}T23:59:59`).toISOString() : '');
  }
  date(value: string) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
  euros(value: number) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value / 100); }
}

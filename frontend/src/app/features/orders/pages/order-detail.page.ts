import { Component, effect, inject, input, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { OrdersStore } from '../store/orders.store';
import { CartStore } from '../../cart/store/cart.store';
import { euro } from '../../../shared/utils/format';
import { statusLabel, statusTone } from '../../../shared/utils/status-presentation';

@Component({
  selector: 'app-order-detail-page',
  imports: [RouterLink],
  template: `
    <section class="account-section">
      <a [routerLink]="backLink" class="back-link">← {{ adminView ? 'Pedidos' : 'Mis pedidos' }}</a>
      <p class="eyebrow">PEDIDO</p><h2>{{ id().slice(-8) }}</h2>
      @if (orders.loading()) { <p role="status">Consultando pedido…</p> }
      @else if (orders.error()) { <p class="inline-alert" role="alert">{{ orders.error() }}</p> }
      @else if (orders.selected(); as order) {
        @if (adminView) { <p class="muted">Comprador: {{ order.buyerName }} · {{ order.buyerEmail }}</p> }
        @if (order.status === 'PAID' && !adminView) {
          <div class="purchase-confirmation" role="status"><p class="eyebrow">COMPRA COMPLETADA</p>
            <h3>{{ order.tickets?.length || 0 }} {{ order.tickets?.length === 1 ? 'entrada emitida' : 'entradas emitidas' }}</h3>
            <p>{{ order.items?.[0]?.eventTitle || 'Tu evento' }}</p>
            <a class="button-primary" routerLink="/account/tickets">Ver mis entradas ↗</a>
          </div>
        }
        <p class="muted">Creado: {{ date(order.createdAt) }} · <span [class]="'state-badge state-' + tone(order.status)">{{ label(order.status) }}</span>
          @if (order.paymentStatus) { · Pago: <span [class]="'state-badge state-' + tone(order.paymentStatus)">{{ label(order.paymentStatus) }}</span> }</p>
        @if (order.providerPaymentId) { <p class="muted">Referencia de pago: {{ order.providerPaymentId }}</p> }
        @if (order.status === 'AWAITING_PAYMENT') {
          <p role="status">Esperando confirmación del pago. Las entradas aparecerán cuando el servidor reciba la confirmación.</p>
          <button class="button-outline" type="button" (click)="refresh()">Consultar estado</button>
        }
        <div class="commerce-list">
          @for (item of order.items ?? []; track item.id) {
            <div class="commerce-row"><div><h3>{{ item.eventTitle }}</h3><p>{{ item.venueName }} · {{ date(item.startsAt) }}</p><p>{{ item.name }} × {{ item.quantity }} · {{ price(item.unitPriceCents / 100) }} por entrada</p></div>
              <strong>{{ price(item.subtotalCents / 100) }}</strong></div>
          }
        </div>
        <p class="checkout-total">Total <strong>{{ price(order.totalCents / 100) }}</strong></p>
        @if (order.tickets?.length) { <section class="dashboard-section"><h3>Entradas emitidas</h3>
          @for (ticket of order.tickets; track ticket.id) {
            <p class="dashboard-alert">Entrada {{ ticket.id.slice(-8) }} · <span [class]="'state-badge state-' + tone(ticket.status)">{{ label(ticket.status) }}</span>
              @if (!adminView) { <a [routerLink]="['/account/tickets', ticket.id]">Abrir QR ↗</a> }
            </p>
          }
        </section> }
      }
    </section>
  `,
})
export class OrderDetailPage implements OnDestroy {
  readonly id = input<string>('');
  readonly orders = inject(OrdersStore);
  readonly price = euro;
  readonly label = statusLabel;
  readonly tone = statusTone;
  private readonly router = inject(Router);
  readonly adminView = this.router.url.startsWith('/dashboard/');
  readonly backLink = this.adminView ? '/dashboard/orders' : '/account/orders';
  date(value: string) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  private readonly cart = inject(CartStore);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private destroyed = false;

  constructor() {
    const callback = this.router.parseUrl(this.router.url);
    if (callback.queryParams['payment_intent_client_secret']) {
      for (const key of ['payment_intent_client_secret', 'payment_intent', 'redirect_status']) delete callback.queryParams[key];
      void this.router.navigateByUrl(callback, { replaceUrl: true });
    }
    effect(() => { const id = this.id(); if (id) void this.load(id); });
  }
  ngOnDestroy() { this.destroyed = true; if (this.timer) clearTimeout(this.timer); }
  refresh() { if (this.timer) clearTimeout(this.timer); this.attempts = 0; void this.load(this.id()); }
  private async load(id: string) {
    await this.orders.loadOrder(id);
    if (this.destroyed || id !== this.id()) return;
    const order = this.orders.selected();
    if (order?.status === 'PAID') {
      if (sessionStorage.getItem('nocturno_checkout_key') === order.idempotencyKey) {
        sessionStorage.removeItem('nocturno_checkout_key');
        sessionStorage.removeItem('nocturno_checkout_user');
      }
      void this.cart.load(true);
    } else if (order?.status === 'AWAITING_PAYMENT' && this.attempts++ < 10) {
      this.timer = setTimeout(() => void this.load(id), 2000);
    }
  }
}

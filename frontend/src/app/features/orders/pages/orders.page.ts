import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrdersStore } from '../store/orders.store';
import { euro, fullEventDate } from '../../../shared/utils/format';

@Component({
  selector: 'app-orders-page',
  imports: [RouterLink],
  template: `
    <section class="account-section">
      <p class="eyebrow">HISTORIAL</p><h2>Mis pedidos</h2>
      @if (orders.loading()) { <p role="status">Cargando pedidos…</p> }
      @else if (orders.error()) { <p class="inline-alert" role="alert">{{ orders.error() }}</p> }
      @else if (!orders.orders().length) { <p>Aún no tienes pedidos. Cuando completes una compra aparecerá aquí.</p><a class="button-outline" routerLink="/">Descubrir eventos ↗</a> }
      @else {
        <div class="commerce-list">
          @for (order of orders.orders(); track order.id) {
            <a class="commerce-row" [routerLink]="['/account/orders', order.id]">
              <div><p class="eyebrow">{{ date(order.createdAt) }} · {{ order.paymentStatus || order.status }}</p><h3>{{ order.eventTitles || 'Pedido ' + order.id.slice(-8) }}</h3>
                <span>Ref. {{ order.id.slice(-8) }} · {{ order.itemCount ?? 0 }} entrada{{ order.itemCount === 1 ? '' : 's' }}</span></div>
              <strong>{{ price(order.totalCents / 100) }} ↗</strong>
            </a>
          }
        </div>
        @if (orders.pagination().page < orders.pagination().totalPages) {
          <button class="button-outline" type="button" (click)="orders.loadOrders(orders.pagination().page + 1)">Más pedidos</button>
        }
      }
    </section>
  `,
})
export class OrdersPage implements OnInit {
  readonly orders = inject(OrdersStore);
  readonly price = euro;
  readonly date = fullEventDate;
  ngOnInit() { void this.orders.loadOrders(); }
}

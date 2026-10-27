import { Component, computed, input, output, signal } from '@angular/core';
import { TicketType } from '../../core/models/domain.model';
import { euro } from '../utils/format';
import { ticketQuantityLimit, ticketSubtotalCents } from '../utils/ticketing';

@Component({
  selector: 'app-ticket-type-card',
  template: `
    <article class="ticket-card" [class.ticket-unavailable]="unavailable()">
      <div class="ticket-copy">
        <p class="eyebrow">ENTRADA</p>
        <h3>{{ ticket().name }}</h3>
        @if (ticket().benefits.length) { <p class="ticket-benefits">{{ ticket().benefits.map(benefitLabel).join(' · ') }}</p> }
        <p class="ticket-stock">{{ statusLabel() }}</p>
      </div>
      <div class="ticket-action">
        <strong>{{ price(ticket().price) }}</strong>
        <div class="ticket-quantity" role="group" [attr.aria-label]="'Cantidad de ' + ticket().name">
          <span>Cantidad</span>
          <div class="quantity-stepper">
            <button type="button" aria-label="Quitar una entrada" [disabled]="unavailable() || pending() || selectedQuantity() <= 1" (click)="adjust(-1)">−</button>
            <output aria-live="polite">{{ selectedQuantity() }}</output>
            <button type="button" aria-label="Añadir una entrada" [disabled]="unavailable() || pending() || selectedQuantity() >= limit()" (click)="adjust(1)">+</button>
          </div>
        </div>
        @if (!unavailable()) {
          <p class="ticket-price-equation">{{ price(ticket().price) }} × {{ selectedQuantity() }} <strong>{{ price(subtotalCents() / 100) }}</strong></p>
        }
        <button type="button" [disabled]="unavailable() || pending()" (click)="add.emit({ ticketTypeId: ticket().id, quantity: selectedQuantity() })">
          {{ pending() ? 'Añadiendo…' : 'Añadir ' + selectedQuantity() + (selectedQuantity() === 1 ? ' entrada' : ' entradas') + ' · ' + price(subtotalCents() / 100) }}
        </button>
      </div>
    </article>
  `
})
export class TicketTypeCardComponent {
  readonly ticket = input.required<TicketType>();
  readonly canBuy = input(true);
  readonly pending = input(false);
  readonly add = output<{ ticketTypeId: string; quantity: number }>();
  readonly quantity = signal(1);
  readonly limit = computed(() => ticketQuantityLimit(this.available(), this.ticket().maxPerUser));
  readonly selectedQuantity = computed(() => Math.min(this.quantity(), Math.max(1, this.limit())));
  readonly subtotalCents = computed(() => ticketSubtotalCents(this.ticket().price, this.selectedQuantity()));
  readonly price = euro;
  readonly benefitLabel = (value: string) => value === 'Acceso demo al evento' ? 'Acceso al evento' : value;
  available() { return this.ticket().quantity - this.ticket().sold - this.ticket().reserved; }
  adjust(delta: number) { this.quantity.set(Math.max(1, Math.min(this.limit(), this.selectedQuantity() + delta))); }
  unavailable() {
    const ticket = this.ticket();
    const now = Date.now();
    return !this.canBuy() || !ticket.active || this.available() <= 0 || !!(ticket.salesStart && new Date(ticket.salesStart).getTime() > now) || !!(ticket.salesEnd && new Date(ticket.salesEnd).getTime() < now);
  }
  statusLabel() {
    const ticket = this.ticket();
    if (!this.canBuy()) return 'Venta no disponible';
    if (!ticket.active) return 'Venta no disponible';
    if (this.available() <= 0) return 'Agotada';
    if (ticket.salesStart && new Date(ticket.salesStart).getTime() > Date.now()) return 'Venta próximamente';
    if (ticket.salesEnd && new Date(ticket.salesEnd).getTime() < Date.now()) return 'Venta finalizada';
    return `${this.available()} disponibles`;
  }
}

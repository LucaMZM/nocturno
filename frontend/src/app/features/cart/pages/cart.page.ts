import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartStore } from '../store/cart.store';
import { euro } from '../../../shared/utils/format';
import { ticketQuantityLimit } from '../../../shared/utils/ticketing';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink],
  template: `
    <main class="page-width commerce-page">
      <a routerLink="/" class="back-link">← Seguir descubriendo</a>
      <div class="page-heading"><p class="eyebrow">TU SELECCIÓN</p><h1>Carrito<span>.</span></h1></div>
      @if (cart.error()) { <p class="inline-alert" role="alert">{{ cart.error() }}
        <button type="button" (click)="cart.load()">Reintentar</button></p> }
      @if (cart.loading()) { <p role="status">Cargando carrito…</p> }
      @else if (cart.cart(); as current) {
        @if (!current.items.length) {
          <div class="state-panel"><h2>Tu carrito está vacío.</h2><a class="button-outline" routerLink="/">Ver eventos ↗</a></div>
        } @else {
          <div class="commerce-list">
            @for (item of current.items; track item.id) {
              <article class="commerce-row">
                <div>
                  <p class="eyebrow">{{ item.venueName }}</p>
                  <h2><a [routerLink]="['/events', item.eventSlug]">{{ item.eventTitle }}</a></h2>
                  <p>{{ date(item.startsAt) }} · {{ item.name }}</p>
                  <p>Precio unitario {{ price(item.unitPriceCents / 100) }}</p>
                </div>
                <div class="commerce-row-actions">
                  <div class="ticket-quantity" role="group" [attr.aria-label]="'Cantidad de ' + item.name">
                    <span>Cantidad</span><div class="quantity-stepper">
                      <button type="button" aria-label="Quitar una entrada" [disabled]="cart.pending() || item.quantity <= 1" (click)="cart.updateItem(item.id, item.quantity - 1)">−</button>
                      <output aria-live="polite">{{ item.quantity }}</output>
                      <button type="button" aria-label="Añadir una entrada" [disabled]="cart.pending() || item.quantity >= limit(item.available, item.maxPerUser)" (click)="cart.updateItem(item.id, item.quantity + 1)">+</button>
                    </div>
                  </div>
                  <strong>Subtotal {{ price(item.unitPriceCents * item.quantity / 100) }}</strong>
                  <button class="button-text" type="button" [disabled]="cart.pending()" (click)="cart.removeItem(item.id)">Quitar</button>
                </div>
              </article>
            }
          </div>
          <div class="commerce-summary">
            <p>Total <strong>{{ price(current.totalCents / 100) }}</strong></p>
            <button class="button-primary" type="button" [disabled]="cart.pending()" (click)="checkout()">
              Continuar al pago <span>↗</span>
            </button>
            <button class="button-outline" type="button" [disabled]="cart.pending()" (click)="cart.clear()">Vaciar carrito</button>
          </div>
        }
      }
    </main>
  `,
})
export class CartPage implements OnInit {
  readonly cart = inject(CartStore);
  readonly price = euro;
  readonly limit = ticketQuantityLimit;
  private readonly router = inject(Router);
  ngOnInit() { void this.cart.load(); }
  date(value: string) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  checkout() { void this.router.navigateByUrl('/checkout'); }
}

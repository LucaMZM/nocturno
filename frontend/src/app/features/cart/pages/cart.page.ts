import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartStore } from '../store/cart.store';
import { euro } from '../../../shared/utils/format';
import { ticketQuantityLimit } from '../../../shared/utils/ticketing';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink],
  styleUrl: './cart.page.css',
  template: `
    <section class="page-width commerce-page cart-page" aria-labelledby="cart-title" [attr.aria-busy]="cart.loading() || cart.pending()">
      <a routerLink="/" class="back-link">← Seguir descubriendo</a>
      <div class="page-heading"><h1 id="cart-title">Tu carrito<span>.</span></h1>
        <p class="cart-intro">Tu próxima noche empieza aquí.</p></div>
      @if (cart.error()) { <p class="inline-alert" role="alert">{{ cart.error() }}
        <button type="button" (click)="cart.load(true)">Actualizar carrito</button></p> }
      <p class="cart-feedback" role="status" aria-live="polite">{{ cart.pending() ? 'Actualizando tu selección…' : cart.message() }}</p>
      @if (cart.loading()) {
        <div class="cart-skeleton" role="status" aria-label="Cargando carrito">
          <div class="shimmer"></div><div class="shimmer"></div><div class="shimmer"></div>
        </div>
      } @else if (cart.cart(); as current) {
        @if (!current.items.length) {
          <div class="cart-empty"><span aria-hidden="true">🛒</span><h2>La noche está por elegir.</h2>
            <p>Descubre tu próximo plan y añade las entradas que quieras llevarte.</p>
            <a class="button-primary" routerLink="/">Descubrir eventos <span>↗</span></a></div>
        } @else {
          <div class="cart-layout">
            <div class="cart-items">
              <p class="cart-caption">{{ cart.itemCount() }} {{ cart.itemCount() === 1 ? 'entrada en tu selección' : 'entradas en tu selección' }}</p>
              @for (item of current.items; track item.id) {
                <article class="cart-item" [class.cart-item-unavailable]="!item.purchasable">
                  <a class="cart-cover" [routerLink]="['/events', item.eventSlug]" [attr.aria-label]="'Ver ' + item.eventTitle">
                    @if (item.imageUrl && !brokenImages().has(item.imageUrl)) {
                      <img [src]="item.imageUrl" [alt]="'Imagen de ' + item.eventTitle" loading="lazy" (error)="imageError(item.imageUrl)" />
                    } @else { <span class="cart-cover-fallback" aria-hidden="true">NOCTURNO.</span> }
                  </a>
                  <div class="cart-item-content">
                    <p class="cart-venue">{{ item.venueName }}</p>
                    <h2><a [routerLink]="['/events', item.eventSlug]">{{ item.eventTitle }}</a></h2>
                    <p class="cart-date">{{ date(item.startsAt) }}</p>
                    <p class="cart-ticket-name">{{ item.name }} <span>· {{ price(item.unitPriceCents / 100) }} / entrada</span></p>
                    @if (!item.purchasable) { <p class="cart-availability" role="note">{{ issue(item.unavailableReason) }}</p> }
                    <div class="cart-controls">
                      <div class="quantity-stepper" role="group" [attr.aria-label]="'Cantidad de ' + item.name + ' para ' + item.eventTitle">
                        <button type="button" aria-label="Quitar una entrada" [disabled]="cart.pending() || item.quantity <= 1 || (!item.purchasable && item.unavailableReason !== 'OUT_OF_STOCK' && item.unavailableReason !== 'TICKET_LIMIT')" (click)="cart.updateItem(item.id, item.quantity - 1)">−</button>
                        <output aria-live="polite">{{ item.quantity }}</output>
                        <button type="button" aria-label="Añadir una entrada" [disabled]="cart.pending() || !item.purchasable || item.quantity >= limit(item.available, item.maxPerUser)" (click)="cart.updateItem(item.id, item.quantity + 1)">+</button>
                      </div>
                      <button class="cart-remove" type="button" [disabled]="cart.pending()" [attr.aria-label]="'Quitar ' + item.name + ' de ' + item.eventTitle" (click)="cart.removeItem(item.id)">Quitar</button>
                      <div class="cart-line-total"><span>{{ item.quantity }} × {{ price(item.unitPriceCents / 100) }}</span><strong>{{ price(item.unitPriceCents * item.quantity / 100) }}</strong></div>
                    </div>
                  </div>
                </article>
              }
            </div>
            <aside class="cart-summary" aria-labelledby="summary-title">
              <h2 id="summary-title">Tu selección</h2>
              <dl><div><dt>Entradas</dt><dd>{{ cart.itemCount() }}</dd></div>
                <div class="cart-total"><dt>Total</dt><dd>{{ price(current.totalCents / 100) }}</dd></div></dl>
              <p>El precio y la disponibilidad se confirman al continuar. Las entradas aún no están reservadas.</p>
              @if (!cart.canCheckout()) { <p class="cart-availability" role="note">Hay entradas no disponibles. Ajusta su cantidad o quítalas para continuar.</p> }
              <button class="button-primary" type="button" [disabled]="cart.pending() || !cart.canCheckout()" (click)="checkout()">Continuar <span>↗</span></button>
              <button class="cart-remove cart-clear" type="button" [disabled]="cart.pending()" (click)="cart.clear()">Vaciar carrito</button>
              <a class="cart-continue" routerLink="/">Seguir descubriendo</a>
            </aside>
          </div>
        }
      }
    </section>
  `,
})
export class CartPage implements OnInit {
  readonly cart = inject(CartStore);
  readonly price = euro;
  readonly limit = ticketQuantityLimit;
  readonly brokenImages = signal(new Set<string>());
  private readonly router = inject(Router);
  ngOnInit() { void this.cart.load(true); }
  imageError(url: string) { this.brokenImages.update(previous => new Set([...previous, url])); }
  date(value: string) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  issue(code: string | null) {
    if (code === 'OUT_OF_STOCK') return 'No quedan suficientes entradas. Reduce la cantidad o retira esta selección.';
    if (code === 'TICKET_LIMIT') return 'La cantidad supera el límite por persona. Reduce tu selección.';
    if (code === 'SALES_NOT_STARTED') return 'La venta todavía no ha comenzado. Retira esta selección para continuar.';
    if (code === 'SALES_ENDED') return 'La venta ha terminado. Retira esta selección para continuar.';
    return 'Esta entrada ya no está disponible. Retírala del carrito para continuar.';
  }
  checkout() { if (this.cart.canCheckout() && !this.cart.pending()) void this.router.navigateByUrl('/checkout'); }
}

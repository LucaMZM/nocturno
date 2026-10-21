import { Component, effect, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartStore } from '../../cart/store/cart.store';
import { euro } from '../../../shared/utils/format';
import { CheckoutStore } from '../store/checkout.store';
import { StripeCheckoutService } from '../services/stripe-checkout.service';
import { AuthStore } from '../../auth/store/auth.store';

@Component({
  selector: 'app-checkout-page',
  imports: [RouterLink],
  providers: [CheckoutStore],
  template: `
    <main class="page-width commerce-page checkout-page">
      <a routerLink="/cart" class="back-link">← Volver al carrito</a>
      <div class="page-heading"><p class="eyebrow">COMPRA SEGURA</p><h1>Finalizar compra<span>.</span></h1></div>
      <div class="demo-checkout-notice" role="note"><strong>PORTFOLIO DEMO · SIN COBROS REALES</strong>
        <span>{{ checkout.config()?.testMode ? 'Stripe está en modo test. Utiliza tarjetas de prueba.' : 'Las compras de esta demo requieren claves de prueba de Stripe.' }}</span></div>
      @if (cart.cart(); as current) {
        <div class="checkout-layout">
          <section class="editor-panel">
            <h2>Pago</h2>
            @if (auth.user(); as buyer) {
              <div class="checkout-buyer"><span>COMPRADOR</span><strong>{{ buyer.displayName }}</strong><small>{{ buyer.email }}</small></div>
            }
            @if (checkout.error()) { <p class="inline-alert" role="alert">{{ checkout.error() }}</p> }
            @if (checkout.error() && !checkout.config()) {
              <button class="button-outline" type="button" (click)="checkout.loadConfig()">Reintentar conexión ↗</button>
            }
            @if (paymentError()) { <p class="inline-alert" role="alert">{{ paymentError() }}</p> }
            @if (!checkout.config() && !checkout.error()) {
              <p role="status">Comprobando el pago…</p>
            } @else if (!checkout.config()?.enabled && current.totalCents > 0) {
              <p>El pago con Stripe todavía no está configurado en este entorno.</p>
            } @else if (!checkout.session()) {
              <p>{{ current.totalCents === 0 ? 'Confirmaremos las entradas gratuitas en el servidor.' : 'Reservaremos las entradas durante 30 minutos y calcularemos el importe en el servidor.' }}</p>
              <button class="button-primary" type="button" [disabled]="checkout.loading() || !current.items.length"
                (click)="preparePayment()">
                {{ checkout.loading() ? 'Preparando…' : current.totalCents === 0 ? 'Confirmar entradas' : 'Preparar pago' }} <span>↗</span>
              </button>
            } @else {
              <div #paymentHost class="payment-element" aria-label="Formulario de pago seguro"></div>
              @if (checkout.session()?.clientSecret) {
                <button class="button-primary" type="button" [disabled]="paying() || !paymentReady()" (click)="confirmPayment()">
                  {{ paying() ? 'Procesando…' : 'Pagar ' + price(checkout.session()!.order.totalCents / 100) }} <span>↗</span>
                </button>
              }
            }
          </section>
          <aside class="editor-panel checkout-summary">
            <h2>Resumen</h2>
            @for (item of current.items; track item.id) {
              <p>{{ item.eventTitle }} · {{ item.name }} × {{ item.quantity }}
                <strong>{{ price(item.unitPriceCents * item.quantity / 100) }}</strong></p>
            }
            <p class="checkout-total">Total <strong>{{ price((checkout.session()?.order.totalCents ?? current.totalCents) / 100) }}</strong></p>
          </aside>
        </div>
      } @else { <p>Cargando carrito…</p> }
    </main>
  `,
})
export class CheckoutPage implements OnInit, OnDestroy {
  readonly cart = inject(CartStore);
  readonly auth = inject(AuthStore);
  readonly checkout = inject(CheckoutStore);
  readonly paymentReady = signal(false);
  readonly paymentError = signal<string | null>(null);
  readonly paying = signal(false);
  readonly price = euro;
  private readonly stripe = inject(StripeCheckoutService);
  private readonly router = inject(Router);
  private readonly paymentHost = viewChild<ElementRef<HTMLElement>>('paymentHost');
  private mountedSecret: string | null = null;

  constructor() {
    effect(() => {
      const host = this.paymentHost();
      const secret = this.checkout.session()?.clientSecret;
      const key = this.checkout.config()?.publishableKey;
      if (host && secret && key && secret !== this.mountedSecret) {
        this.mountedSecret = secret;
        void this.stripe.mount(host.nativeElement, key, secret)
          .then(() => this.paymentReady.set(true))
          .catch((error: Error) => this.paymentError.set(error.message));
      }
    });
  }

  ngOnInit() { void this.cart.load(); void this.checkout.loadConfig(); }
  ngOnDestroy() { this.stripe.destroy(); }

  async preparePayment() {
    if (!await this.checkout.start()) return;
    const session = this.checkout.session();
    if (session?.order.status === 'PAID')
      await this.router.navigate(['/account/orders', session.order.id]);
  }

  async confirmPayment() {
    const orderId = this.checkout.session()?.order.id;
    if (!orderId) return;
    this.paying.set(true);
    this.paymentError.set(null);
    try {
      const result = await this.stripe.confirm(orderId);
      if (result.error) this.paymentError.set(result.error.message ?? 'No hemos podido completar el pago.');
      else await this.router.navigate(['/account/orders', orderId]);
    } catch (error) {
      this.paymentError.set(error instanceof Error ? error.message : 'Error al confirmar el pago.');
    } finally { this.paying.set(false); }
  }
}

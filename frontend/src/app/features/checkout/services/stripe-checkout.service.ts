import { Injectable } from '@angular/core';

interface StripeError { message?: string; }
interface StripePaymentResult { error?: StripeError; paymentIntent?: { status: string }; }
interface StripeElement { mount(element: HTMLElement): void; destroy(): void; }
interface StripeElements { create(type: 'payment'): StripeElement; }
interface StripeInstance {
  elements(options: { clientSecret: string; appearance: { theme: 'night'; variables: { colorPrimary: string } } }): StripeElements;
  confirmPayment(options: {
    elements: StripeElements;
    confirmParams: { return_url: string };
    redirect: 'if_required';
  }): Promise<StripePaymentResult>;
}
declare global { interface Window { Stripe?: (publishableKey: string) => StripeInstance; } }

@Injectable({ providedIn: 'root' })
export class StripeCheckoutService {
  private stripe: StripeInstance | null = null;
  private elements: StripeElements | null = null;
  private paymentElement: StripeElement | null = null;
  private scriptPromise: Promise<void> | null = null;

  private loadScript(): Promise<void> {
    if (window.Stripe) return Promise.resolve();
    if (!this.scriptPromise) this.scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => window.Stripe ? resolve() : reject(new Error('Stripe.js no está disponible.'));
      script.onerror = () => reject(new Error('No hemos podido cargar el formulario de pago.'));
      document.head.append(script);
    });
    return this.scriptPromise;
  }

  async mount(host: HTMLElement, publishableKey: string, clientSecret: string) {
    await this.loadScript();
    this.paymentElement?.destroy();
    this.stripe = window.Stripe!(publishableKey);
    this.elements = this.stripe.elements({ clientSecret,
      appearance: { theme: 'night', variables: { colorPrimary: '#e50914' } } });
    this.paymentElement = this.elements.create('payment');
    this.paymentElement.mount(host);
  }

  async confirm(orderId: string): Promise<StripePaymentResult> {
    if (!this.stripe || !this.elements) throw new Error('El formulario de pago aún no está preparado.');
    return this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: { return_url: `${window.location.origin}/account/orders/${orderId}` },
      redirect: 'if_required'
    });
  }

  destroy() { this.paymentElement?.destroy(); this.paymentElement = null; this.elements = null; }
}

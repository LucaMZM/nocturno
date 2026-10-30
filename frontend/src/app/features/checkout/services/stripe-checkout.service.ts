import { Injectable } from '@angular/core';

interface StripeError { message?: string; }
interface StripePaymentResult { error?: StripeError; paymentIntent?: { status: string }; }
interface StripeElement {
  mount(element: HTMLElement): void;
  destroy(): void;
  on(event: 'ready' | 'loaderror', callback: () => void): void;
}
interface StripeElements {
  create(type: 'payment'): StripeElement;
  submit(): Promise<{ error?: StripeError }>;
}
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
  private generation = 0;
  private confirmingGeneration: number | null = null;
  private cancelMount: (() => void) | null = null;

  private loadScript(): Promise<void> {
    if (window.Stripe) return Promise.resolve();
    if (!this.scriptPromise) this.scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(failed, 20000);
      function failed() {
        clearTimeout(timer);
        script.remove();
        reject(new Error('No hemos podido cargar el formulario de pago.'));
      }
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => { clearTimeout(timer); window.Stripe ? resolve() : failed(); };
      script.onerror = failed;
      document.head.append(script);
    }).catch(error => { this.scriptPromise = null; throw error; });
    return this.scriptPromise;
  }

  async mount(host: HTMLElement, publishableKey: string, clientSecret: string) {
    this.destroy();
    const generation = this.generation;
    await this.loadScript();
    if (generation !== this.generation || !host.isConnected)
      throw new Error('El formulario de pago se ha cerrado.');
    this.stripe = window.Stripe!(publishableKey);
    this.elements = this.stripe.elements({ clientSecret,
      appearance: { theme: 'night', variables: { colorPrimary: '#e50914' } } });
    this.paymentElement = this.elements.create('payment');
    await new Promise<void>((resolve, reject) => {
      const element = this.paymentElement!;
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.cancelMount = null;
        error ? reject(error) : resolve();
      };
      const timer = setTimeout(() => finish(new Error('El formulario de pago no responde.')), 20000);
      this.cancelMount = () => finish(new Error('El formulario de pago se ha cerrado.'));
      element.on('ready', () => finish());
      element.on('loaderror', () => finish(new Error('No hemos podido cargar el formulario de pago.')));
      try { element.mount(host); }
      catch { finish(new Error('No hemos podido mostrar el formulario de pago.')); }
    });
  }

  async confirm(orderId: string): Promise<StripePaymentResult> {
    const stripe = this.stripe, elements = this.elements;
    if (!stripe || !elements) throw new Error('El formulario de pago aún no está preparado.');
    const generation = this.generation;
    if (this.confirmingGeneration === generation) throw new Error('El pago ya se está procesando.');
    this.confirmingGeneration = generation;
    try {
      const validation = await elements.submit();
      if (generation !== this.generation) throw new Error('El formulario de pago se ha cerrado.');
      if (validation.error) return validation;
      return await stripe.confirmPayment({ elements,
        confirmParams: { return_url: `${window.location.origin}/account/orders/${orderId}` },
        redirect: 'if_required' });
    } finally { if (this.confirmingGeneration === generation) this.confirmingGeneration = null; }
  }

  destroy() {
    this.generation++;
    this.cancelMount?.();
    this.paymentElement?.destroy();
    this.paymentElement = null;
    this.elements = null;
    this.stripe = null;
  }
}

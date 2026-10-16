import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TicketsStore } from '../store/tickets.store';
import { eventTime, fullEventDate } from '../../../shared/utils/format';
import { statusLabel, statusTone } from '../../../shared/utils/status-presentation';

@Component({
  selector: 'app-ticket-detail-page',
  imports: [RouterLink],
  template: `
    <section class="account-section ticket-detail">
      <a routerLink="/account/tickets" class="back-link">← Mis entradas</a>
      @if (tickets.loading()) { <p role="status">Cargando entrada…</p> }
      @else if (tickets.error()) { <p class="inline-alert" role="alert">{{ tickets.error() }}</p> }
      @else if (tickets.selected(); as ticket) {
        <article class="ticket-pass">
          <div class="ticket-pass-heading"><strong>NOCTURNO.</strong><span [class]="'state-badge state-' + tone(ticket.status)">{{ label(ticket.status) }}</span></div>
          <div class="ticket-pass-event"><p class="eyebrow">{{ ticket.ticketTypeName }}</p><h2>{{ ticket.eventTitle }}</h2>
            <p>{{ date(ticket.startsAt) }} · {{ time(ticket.startsAt) }}</p></div>
          <div class="ticket-pass-facts"><div><span>LOCAL</span><strong>{{ ticket.venueName }}</strong><small>{{ ticket.venueAddress }}</small></div>
            <div><span>TITULAR</span><strong>{{ ticket.displayName }}</strong></div>
            <div><span>PEDIDO</span><strong>{{ ticket.orderId.slice(-8) }}</strong></div>
            <div><span>ENTRADA</span><strong>{{ ticket.id.slice(-8) }}</strong></div></div>
          <div class="ticket-pass-code">
            @if (ticket.status === 'VALID' && qr()) {
              <img class="ticket-qr" [src]="qr()!" [alt]="'Código QR de ' + ticket.eventTitle" />
              <p>Presenta este código en el acceso. Contiene un identificador aleatorio; los datos del titular se consultan en el servidor.</p>
              <code>{{ ticket.code }}</code>
            } @else if (ticket.status === 'USED') {
              <p>Entrada utilizada el {{ ticket.usedAt ? date(ticket.usedAt) : 'día del evento' }}.</p>
            } @else { <p>Esta entrada no es válida para acceder.</p> }
          </div>
        </article>
      }
    </section>
  `,
})
export class TicketDetailPage {
  readonly id = input<string>('');
  readonly tickets = inject(TicketsStore);
  readonly qr = signal<string | null>(null);
  readonly date = fullEventDate;
  readonly time = eventTime;
  readonly label = statusLabel;
  readonly tone = statusTone;

  constructor() { effect(() => { const id = this.id(); if (id) void this.load(id); }); }
  private async load(id: string) {
    this.qr.set(null);
    await this.tickets.loadTicket(id);
    const ticket = this.tickets.selected();
    if (ticket?.status !== 'VALID') return;
    const qrCode = await import('qrcode');
    this.qr.set(await qrCode.toDataURL(ticket.code, { width: 256, margin: 2,
      errorCorrectionLevel: 'H', color: { dark: '#080808', light: '#f5f2ec' } }));
  }
}

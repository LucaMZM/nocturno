import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TicketsStore } from '../store/tickets.store';
import { fullEventDate } from '../../../shared/utils/format';

@Component({
  selector: 'app-tickets-page',
  imports: [RouterLink],
  template: `
    <section class="account-section">
      <p class="eyebrow">ACCESOS</p><h2>Mis entradas</h2>
      @if (tickets.loading()) { <p role="status">Cargando entradas…</p> }
      @else if (tickets.error()) { <p class="inline-alert" role="alert">{{ tickets.error() }}</p> }
      @else if (!tickets.tickets().length) { <p>Tus entradas aparecerán aquí cuando completes una compra.</p><a class="button-outline" routerLink="/">Descubrir eventos ↗</a> }
      @else {
        <div class="commerce-list">
          @for (ticket of tickets.tickets(); track ticket.id) {
            <a class="commerce-row" [routerLink]="['/account/tickets', ticket.id]">
              <div><p class="eyebrow">{{ status(ticket.status, ticket.endsAt) }}</p><h3>{{ ticket.eventTitle }}</h3>
                <p>{{ ticket.venueName }} · {{ date(ticket.startsAt) }}</p>
                <p>{{ ticket.ticketTypeName }} · Código {{ ticket.code.slice(0, 8) }}…</p></div><span>Ver entrada ↗</span>
            </a>
          }
        </div>
        @if (tickets.pagination().page < tickets.pagination().totalPages) {
          <button class="button-outline" type="button" (click)="tickets.loadTickets(tickets.pagination().page + 1)">Más entradas</button>
        }
      }
    </section>
  `,
})
export class TicketsPage implements OnInit {
  readonly tickets = inject(TicketsStore);
  readonly date = fullEventDate;
  status(value: string, endsAt: string) {
    if (value === 'VALID' && new Date(endsAt) < new Date()) return 'EVENTO FINALIZADO';
    return ({ VALID: 'VÁLIDA', USED: 'USADA', CANCELLED: 'CANCELADA', REFUNDED: 'REEMBOLSADA' } as Record<string, string>)[value] || value;
  }
  ngOnInit() { void this.tickets.loadTickets(); }
}

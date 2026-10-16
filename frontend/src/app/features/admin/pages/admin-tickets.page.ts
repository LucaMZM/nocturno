import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminStore } from '../store/admin.store';
import { statusLabel, statusTone } from '../../../shared/utils/status-presentation';

@Component({
  selector: 'app-admin-tickets-page',
  providers: [AdminStore],
  imports: [FormsModule],
  template: `
    <div class="dashboard-heading"><p class="eyebrow">ACCESO</p><h2>Entradas emitidas<span>.</span></h2></div>
    <form class="management-filters" (ngSubmit)="searchTickets()">
      <label>Buscar <input name="search" [(ngModel)]="query" placeholder="Evento o código" /></label>
      <label>Estado <select name="status" [(ngModel)]="status"><option value="">Todos</option>
        <option value="VALID">Válida</option><option value="USED">Usada</option>
        <option value="CANCELLED">Cancelada</option><option value="REFUNDED">Reembolsada</option></select></label>
      <button class="button-outline">Filtrar</button>
    </form>
    @if (store.loading()) { <p role="status">Cargando entradas…</p> }
    @if (store.error()) { <p class="inline-alert" role="alert">{{ store.error() }}</p> }
    @if (!store.loading() && !store.error() && !store.tickets().length) { <p class="muted">No hay entradas con estos filtros.</p> }
    <div class="management-table-wrap"><table class="management-table"><thead><tr>
      <th>Evento</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th>Identificador</th>
    </tr></thead><tbody>
      @for (ticket of store.tickets(); track ticket.id) { <tr>
        <td>{{ ticket.eventTitle }}</td><td>{{ ticket.ticketTypeName }}</td>
        <td>{{ date(ticket.issuedAt) }}</td><td><span [class]="'state-badge state-' + tone(ticket.status)">{{ label(ticket.status) }}</span></td><td>{{ ticket.id.slice(-8) }}</td>
      </tr> }
    </tbody></table></div>
    <div class="pagination-actions"><button class="button-outline" [disabled]="store.pagination().page <= 1" (click)="page(-1)">Anterior</button>
      <span>Página {{ store.pagination().page }} de {{ store.pagination().totalPages || 1 }}</span>
      <button class="button-outline" [disabled]="store.pagination().page >= store.pagination().totalPages" (click)="page(1)">Siguiente</button></div>
  `,
})
export class AdminTicketsPage implements OnInit {
  readonly store = inject(AdminStore);
  readonly label = statusLabel;
  readonly tone = statusTone;
  readonly query = signal('');
  readonly status = signal('');
  ngOnInit() { void this.store.loadTickets(); }
  searchTickets() { void this.store.loadTickets(1, this.query(), this.status()); }
  page(delta: number) { void this.store.loadTickets(this.store.pagination().page + delta, this.query(), this.status()); }
  date(value: string) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short' }).format(new Date(value)); }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../auth/store/auth.store';
import { DashboardStore } from '../store/dashboard.store';
import { statusLabel, statusTone } from '../../../shared/utils/status-presentation';

import { EventDeletionDialogComponent } from '../../events/components/event-deletion-dialog/event-deletion-dialog.component';

type EventView = 'all' | 'active' | 'inactive' | 'deleted';

@Component({
  selector: 'app-dashboard-events-page',
  imports: [RouterLink, FormsModule, EventDeletionDialogComponent],
  template: `
    @if (dashboard.deletionEventId()) {
      <app-event-deletion-dialog [title]="dashboard.deletionTitle()" [impact]="dashboard.deletionImpact()"
        [loading]="dashboard.deletionLoading()" [saving]="dashboard.deletionSaving()"
        [error]="dashboard.deletionError()" [stale]="dashboard.deletionStale()" [result]="dashboard.deletionResult()"
        (dismiss)="dashboard.closeEventDeletion()" (refresh)="refreshDeletion()" (confirm)="confirmDeletion()" />
    }
    <div class="dashboard-heading row-between">
      <div><p class="eyebrow">PROGRAMACIÓN</p><h2>Eventos<span>.</span></h2></div>
      <a class="button-primary" routerLink="/dashboard/events/create">Crear evento <span>＋</span></a>
    </div>
    @if (auth.user()?.role === 'ADMIN') {
      <div class="event-view-tabs" role="group" aria-label="Vista de eventos">
        <button type="button" [class.selected]="view() === 'all'" [attr.aria-pressed]="view() === 'all'" (click)="changeView('all')">Todos</button>
        <button type="button" [class.selected]="view() === 'active'" [attr.aria-pressed]="view() === 'active'" (click)="changeView('active')">Activos</button>
        <button type="button" [class.selected]="view() === 'inactive'" [attr.aria-pressed]="view() === 'inactive'" (click)="changeView('inactive')">Inactivos</button>
        <button type="button" [class.selected]="view() === 'deleted'" [attr.aria-pressed]="view() === 'deleted'" (click)="changeView('deleted')">Borrados</button>
      </div>
    }
    <form class="management-filters" (ngSubmit)="search()">
      <label>Buscar <input name="search" [(ngModel)]="query" placeholder="Título del evento" /></label>
      <label>Estado <select name="status" [(ngModel)]="status">
        <option value="">Todos</option><option value="DRAFT">Borrador</option>
        <option value="PENDING_REVIEW">En revisión</option><option value="PUBLISHED">Publicado</option>
        <option value="SOLD_OUT">Agotado</option><option value="CANCELLED">Cancelado</option>
        <option value="FINISHED">Finalizado</option><option value="REJECTED">Rechazado</option>
      </select></label><button class="button-outline">Filtrar</button>
    </form>
    @if (dashboard.loading()) { <p role="status">Cargando eventos…</p> }
    @if (dashboard.error()) { <p class="inline-alert" role="alert">{{ dashboard.error() }}</p> }
    @if (!dashboard.loading() && !dashboard.error() && !dashboard.events().length) { <p class="muted">{{ view() === 'deleted' ? 'La papelera está vacía.' : 'No hay eventos con estos filtros.' }}</p> }
    <div class="management-table-wrap"><table class="management-table"><thead><tr>
      <th>Evento</th><th>Local</th><th>Fecha</th><th>Estado</th><th>Actividad</th><th>Acciones</th>
    </tr></thead><tbody>
      @for (event of dashboard.events(); track event.id) { <tr
        [class.management-row-inactive]="!event.isActive && !event.deletedAt"
        [class.management-row-deleted]="!!event.deletedAt"
        [class.management-row-unpublished]="event.isActive && !event.deletedAt && !['PUBLISHED','SOLD_OUT'].includes(event.status)">
        <td><strong>{{ event.title }}</strong></td><td>{{ event.venueName }}</td>
        <td>{{ date(event.startsAt) }}</td><td><span [class]="'state-badge state-' + tone(event.status)">{{ label(event.status) }}</span></td>
        <td><span [class]="'state-badge state-' + tone(event.deletedAt ? 'DELETED' : event.isActive ? 'ACTIVE' : 'INACTIVE')">
          {{ label(event.deletedAt ? 'DELETED' : event.isActive ? 'ACTIVE' : 'INACTIVE') }}</span></td>
        <td>@if (view() === 'deleted') {
          <button class="text-action" type="button" [disabled]="dashboard.saving()" (click)="restore(event.id)">Restaurar</button>
        } @else {
          <a [routerLink]="['/dashboard/events', event.id, 'edit']">Editar</a>
          <a [routerLink]="['/dashboard/events', event.id, 'tickets']">Entradas</a>
          <a [routerLink]="['/dashboard/events', event.id, 'check-in']">Check-in</a>
          <button class="text-action" type="button" [disabled]="dashboard.saving()" (click)="setActive(event.id, !event.isActive)">{{ event.isActive ? 'Desactivar' : 'Activar' }}</button>
          <button class="text-action danger" type="button" [disabled]="dashboard.saving()" (click)="remove(event.id, event.title)">Eliminar</button>
        }</td>
      </tr> }
    </tbody></table></div>
    <div class="pagination-actions">
      <button class="button-outline" [disabled]="dashboard.pagination().page <= 1" (click)="page(-1)">Anterior</button>
      <span>Página {{ dashboard.pagination().page }} de {{ dashboard.pagination().totalPages || 1 }}</span>
      <button class="button-outline" [disabled]="dashboard.pagination().page >= dashboard.pagination().totalPages" (click)="page(1)">Siguiente</button>
    </div>
  `,
})
export class DashboardEventsPage implements OnInit {
  readonly dashboard = inject(DashboardStore);
  readonly label = statusLabel;
  readonly tone = statusTone;
  readonly auth = inject(AuthStore);
  readonly query = signal('');
  readonly status = signal('');
  readonly view = signal<EventView>('all');
  ngOnInit() { void this.dashboard.loadEvents(); }
  private load(page = 1) {
    const view = this.view();
    void this.dashboard.loadEvents(page, this.query(), this.status(), view === 'deleted' ? 'only' : 'exclude',
      view === 'active' ? 'true' : view === 'inactive' ? 'false' : 'all');
  }
  changeView(view: EventView) { this.view.set(view); this.load(); }
  search() { this.load(); }
  page(delta: number) { this.load(this.dashboard.pagination().page + delta); }
  remove(id: string, title: string) {
    void this.dashboard.analyzeEventDeletion(id, title);
  }
  refreshDeletion() {
    const id = this.dashboard.deletionEventId();
    if (id) void this.dashboard.analyzeEventDeletion(id, this.dashboard.deletionTitle());
  }
  async confirmDeletion() {
    if (await this.dashboard.confirmEventDeletion()) this.search();
  }
  async restore(id: string) {
    if (await this.dashboard.restoreEvent(id)) this.changeView('inactive');
  }
  async setActive(id: string, active: boolean) {
    if (await this.dashboard.setEventActive(id, active)) this.search();
  }
  date(value: string) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
}

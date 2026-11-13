import { toSignal } from '@angular/core/rxjs-interop';
import { managementDefaults, ManagementFilters, parseManagementFilters, managementChips, monthDays } from '../utils/management-filters';
import { Component, inject, OnInit, computed, effect, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
      <label>Buscar <input name="search" [ngModel]="filters().search" (ngModelChange)="change('search', $event)" placeholder="Título del evento" /></label>
      <label>Estado <select name="status" [ngModel]="filters().status" (ngModelChange)="change('status', $event)">
        <option value="">Todos</option><option value="DRAFT">Borrador</option>
        <option value="PENDING_REVIEW">En revisión</option><option value="PUBLISHED">Publicado</option>
        <option value="SOLD_OUT">Agotado</option><option value="CANCELLED">Cancelado</option>
        <option value="FINISHED">Finalizado</option><option value="REJECTED">Rechazado</option>
      </select></label>
      <label>Promotor <select name="promoterId" [ngModel]="filters().promoterId" (ngModelChange)="change('promoterId',$event)">
        <option value="">Todos</option>@for (item of dashboard.filterPromoters(); track item.id) { <option [value]="item.id">{{ item.name }}</option> }
      </select></label>
      <label>Local <select name="venueId" [ngModel]="filters().venueId" (ngModelChange)="change('venueId',$event)">
        <option value="">Todos</option>@for (item of dashboard.filterVenues(); track item.id) { <option [value]="item.id">{{ item.name }}</option> }
      </select></label>
      <label>Ciudad <input name="municipality" [ngModel]="filters().municipality" (ngModelChange)="change('municipality',$event)" /></label>
      <label>Periodo <select name="period" [ngModel]="filters().period" (ngModelChange)="change('period',$event)">
        <option value="all">Todos</option><option value="upcoming">Próximos</option><option value="past">Pasados</option><option value="custom">Personalizado</option>
      </select></label>
      <label>Desde <input type="date" name="dateFrom" [ngModel]="filters().dateFrom" (ngModelChange)="change('dateFrom',$event)" /></label>
      <label>Hasta <input type="date" name="dateTo" [ngModel]="filters().dateTo" (ngModelChange)="change('dateTo',$event)" /></label>
      <label>Orden <select name="sort" [ngModel]="filters().sort" (ngModelChange)="change('sort',$event)">
        <option value="recent">Más recientes</option><option value="dateAsc">Fecha ascendente</option><option value="dateDesc">Fecha descendente</option>
        <option value="titleAsc">Nombre A–Z</option><option value="titleDesc">Nombre Z–A</option><option value="sold">Entradas vendidas</option><option value="views">Más visitados · 30 días</option>
      </select></label><button class="button-outline">Actualizar</button>
    </form>
    <p>Filtros activos: {{ chips().length }}</p>
    <div class="filter-chips">
      @for (chip of chips(); track chip.key) { <button class="button-outline" (click)="change(chip.key, defaults[chip.key])">{{ chip.label }}: {{ chip.value }} ×</button> }
      @if (chips().length) { <button class="text-action" (click)="clear()">Limpiar todos</button> }
    </div>
    <div class="event-view-tabs" role="group" aria-label="Presentación">
      @for (item of displays; track item.id) { <button [attr.aria-pressed]="filters().view === item.id" [class.selected]="filters().view === item.id" (click)="change('view',item.id)">{{ item.label }}</button> }
    </div>
    @if (filters().view === 'calendar') {
      <div class="row-between"><button class="button-outline" (click)="month(-1)">Mes anterior</button>
        <label>Mes <input type="month" [ngModel]="filters().month" (ngModelChange)="change('month',$event)" /></label>
        <button class="button-outline" (click)="month(1)">Mes siguiente</button></div>
      <p class="muted">Horario de Europe/Madrid · {{ dashboard.events().length }} eventos en el periodo filtrado</p>
      <div class="admin-calendar">
        @for (day of days(); track day) {
          <section class="calendar-day" [style.grid-column-start]="day.endsWith('-01') ? firstWeekday() : null"><h3>{{ day.slice(-2) }}</h3>
            @for (event of dayEvents(day); track event.id) {
              <a [routerLink]="['/dashboard/events',event.id,'edit']" [class]="'state-badge state-' + tone(event.status)">{{ event.title }}</a>
            }
          </section>
        }
      </div>
    }
    @if (filters().view === 'grid') {
      <div class="admin-event-grid">
        @for (event of dashboard.events(); track event.id) {
          <article class="admin-event-card">
            @if (event.posterUrl) { <img [src]="event.posterUrl" alt="" loading="lazy" /> }
            <h3>{{ event.title }}</h3><p>{{ date(event.startsAt) }} · {{ event.venueName }}</p>
            <span [class]="'state-badge state-' + tone(event.status)">{{ label(event.status) }}</span>
            <span [class]="'state-badge state-' + tone(event.deletedAt ? 'DELETED' : event.isActive ? 'ACTIVE' : 'INACTIVE')">{{ label(event.deletedAt ? 'DELETED' : event.isActive ? 'ACTIVE' : 'INACTIVE') }}</span>
            <p>{{ event.soldCount ?? 0 }} entradas vendidas</p>
            @if (!event.deletedAt) {
              <a [routerLink]="['/dashboard/events',event.id,'edit']">Editar</a> ·
              <a [routerLink]="['/dashboard/events',event.id,'tickets']">Entradas</a>
              <button class="text-action" [disabled]="dashboard.saving()" (click)="setActive(event.id,!event.isActive)">{{ event.isActive ? 'Desactivar' : 'Activar' }}</button>
            } @else { <button class="text-action" [disabled]="dashboard.saving()" (click)="restore(event.id)">Restaurar</button> }
          </article>
        }
      </div>
    }
    @if (dashboard.loading()) { <p role="status">Cargando eventos…</p> }
    @if (dashboard.error()) { <p class="inline-alert" role="alert">{{ dashboard.error() }}</p> }
    @if (!dashboard.loading() && !dashboard.error() && !dashboard.events().length) { <p class="muted">{{ view() === 'deleted' ? 'La papelera está vacía.' : 'No hay eventos con estos filtros.' }}</p> }
    @if (filters().view === 'table') {
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
    }
    @if (filters().view !== 'calendar') {
    <div class="pagination-actions">
      <button class="button-outline" [disabled]="dashboard.pagination().page <= 1" (click)="page(-1)">Anterior</button>
      <span>Página {{ dashboard.pagination().page }} de {{ dashboard.pagination().totalPages || 1 }}</span>
      <button class="button-outline" [disabled]="dashboard.pagination().page >= dashboard.pagination().totalPages" (click)="page(1)">Siguiente</button>
    </div>
    }
  `,
  styles: [`
    .admin-event-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:1rem}
    .admin-event-card{padding:1rem;background:#171717;border:1px solid #333}
    .admin-event-card img{width:100%;height:170px;object-fit:cover}
    .admin-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin:1rem 0}
    .calendar-day{min-width:0;min-height:100px;border:1px solid #333;padding:.5rem}
    .calendar-day a{display:block;white-space:normal;overflow-wrap:anywhere;margin:.4rem 0}
    @media(max-width:700px){.admin-calendar{grid-template-columns:repeat(2,minmax(0,1fr))}.calendar-day{grid-column-start:auto!important}}
  `],
})
export class DashboardEventsPage implements OnInit {
  readonly dashboard = inject(DashboardStore);
  readonly label = statusLabel;
  readonly tone = statusTone;
  readonly auth = inject(AuthStore);
  readonly defaults = managementDefaults;
  readonly filters = this.dashboard.eventFilters;
  readonly chips = computed(() => managementChips(this.filters()));
  readonly days = computed(() => monthDays(this.filters().month));
  readonly firstWeekday = computed(() => (new Date(this.filters().month + '-01T12:00:00Z').getUTCDay()+6)%7+1);
  readonly displays = [{id:'table',label:'Tabla'},{id:'grid',label:'Cuadrícula'},{id:'calendar',label:'Calendario'}];
  readonly view = computed<EventView>(() => this.filters().deleted === 'only' ? 'deleted' : this.filters().active === 'true' ? 'active' : this.filters().active === 'false' ? 'inactive' : 'all');
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  constructor() {
    effect(() => {
      const filters = parseManagementFilters(this.params(), this.auth.user()?.role === 'ADMIN');
      untracked(() => void this.dashboard.loadFilteredEvents(filters));
    });
  }
  ngOnInit() { void this.dashboard.loadFilterOptions(); }
  change(key: keyof ManagementFilters, value: string) {
    const filters = { ...this.filters(), [key]: value, page: key === 'page' ? value : '1' };
    if (key === 'period') { filters.dateFrom = ''; filters.dateTo = ''; }
    if (key === 'dateFrom' || key === 'dateTo') filters.period = 'custom';
    void this.router.navigate([], { relativeTo: this.route, queryParams: filters });
  }
  clear() { void this.router.navigate([], { relativeTo: this.route, queryParams: { view: this.filters().view, month: this.filters().month } }); }
  changeView(view: EventView) {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.filters(), page: '1',
      deleted: view === 'deleted' ? 'only' : 'exclude', active: view === 'active' ? 'true' : view === 'inactive' ? 'false' : 'all' } });
  }
  search() { void this.dashboard.loadFilteredEvents(this.filters()); }
  page(delta: number) { this.change('page', String(Number(this.filters().page) + delta)); }
  month(delta: number) {
    const [year, month] = this.filters().month.split('-').map(Number);
    this.change('month', new Date(Date.UTC(year,month - 1 + delta,1)).toISOString().slice(0,7));
  }
  dayEvents(day: string) {
    return this.dashboard.events().filter(event => new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Madrid'}).format(new Date(event.startsAt)) === day);
  }
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
  date(value: string) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(value)); }
}

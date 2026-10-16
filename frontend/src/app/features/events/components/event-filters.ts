import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, effect, inject, input, output, signal, ViewChild } from '@angular/core';
import type { EventFilters } from '../../../core/models/domain.model';
import {
  EVENT_GENRES,
  EVENT_ATMOSPHERES,
  EVENT_STATUSES,
  EVENT_TYPES,
  EVENT_DRESS_CODES,
  EVENT_IDEALS,
} from '../../../shared/utils/event-filter-contract';
import { readableTag } from '../../../shared/utils/format';

type EventFilterPanel = 'music' | 'price' | 'type' | 'atmosphere' | 'more';
@Component({
  selector: 'app-event-filters',
  template: `
    <div class="filter-bar">
      <div class="filter-chips" aria-label="Filtros de eventos">
        <button
          class="chip-music"
          type="button"
          [class.active]="filters().genre"
          [attr.aria-expanded]="activePanel() === 'music'"
          (click)="toggleFilterPanel('music')"
        >
          Música <span>⌄</span>
        </button>
        <button
          class="chip-price"
          type="button"
          [class.active]="filters().minPrice !== undefined || filters().maxPrice !== undefined"
          [attr.aria-expanded]="activePanel() === 'price'"
          (click)="toggleFilterPanel('price')"
        >
          Precio <span>⌄</span>
        </button>
        <button
          class="chip-type"
          type="button"
          [class.active]="filters().eventType"
          [attr.aria-expanded]="activePanel() === 'type'"
          (click)="toggleFilterPanel('type')"
        >
          Tipo <span>⌄</span>
        </button>
        <button class="chip-atmosphere" type="button" [class.active]="filters().atmosphere" [attr.aria-expanded]="activePanel() === 'atmosphere'" (click)="toggleFilterPanel('atmosphere')">
          Ambiente <span>⌄</span>
        </button>
        <button
          class="chip-more"
          type="button"
          [class.active]="
            filters().province || filters().dressCode ||
            filters().minimumAge !== undefined ||
            filters().status
          "
          [attr.aria-expanded]="activePanel() === 'more'"
          (click)="toggleFilterPanel('more')"
        >
          <span class="desktop-filter-label">Más filtros</span
          ><span class="mobile-filter-label">Filtros</span> <span>＋</span>
        </button>
      </div>
      <span class="filter-count">{{ total() }} {{ total() === 1 ? 'plan' : 'planes' }}</span>
    </div>

    @if (activePanel(); as panel) {
      <div class="filter-backdrop" (click)="closeFilterPanel()" aria-hidden="true"></div>
      <section
        #dialog
        class="filter-panel"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="filterPanelTitle(panel)"
      >
        <div class="filter-panel-head">
          <div>
            <p class="eyebrow">ENCUENTRA TU PLAN</p>
            <h3>{{ filterPanelTitle(panel) }}</h3>
          </div>
          <button
            type="button"
            class="icon-close"
            (click)="closeFilterPanel()"
            aria-label="Cerrar filtros"
          >
            ×
          </button>
        </div>
        <div class="filter-panel-scroll">
          @if (panel === 'more') {
            <label class="field"
              ><span>Municipio</span>
              <select
                [value]="filters().municipality ?? ''"
                #municipality
                (change)="filtersChanged.emit({ municipality: municipality.value || undefined })"
              >
                <option value="" [selected]="!filters().municipality">Todas las localidades</option>
                @for (name of municipalities(); track name) {
                  <option [value]="name" [selected]="filters().municipality === name">
                    {{ name }}
                  </option>
                }
              </select>
            </label>
            <label class="field"
              ><span>Provincia</span>
              <select
                [value]="filters().province ?? ''"
                #province
                (change)="filtersChanged.emit({ province: province.value || undefined })"
              >
                <option value="" [selected]="!filters().province">Todas las provincias</option>
                @for (name of provinces(); track name) {
                  <option [value]="name" [selected]="filters().province === name">
                    {{ name }}
                  </option>
                }
              </select>
            </label>
          }
          @if (panel === 'music' || panel === 'more') {
            <label class="field"
              ><span>Género musical</span>
              <select
                [value]="filters().genre ?? ''"
                #genre
                (change)="filtersChanged.emit({ genre: genre.value || undefined })"
              >
                <option value="" [selected]="!filters().genre">Todos los géneros</option>
                @for (name of genres; track name) {
                  <option [value]="name" [selected]="filters().genre === name">
                    {{ label(name) }}
                  </option>
                }
              </select>
            </label>
          }
          @if (panel === 'price' || panel === 'more') {
            <div class="field-pair">
              <label class="field"
                ><span>Precio desde</span
                ><input
                  type="number"
                  min="0"
                  step="1"
                  [value]="filters().minPrice ?? ''"
                  #minPrice
                  (change)="numberFilterChanged.emit({ key: 'minPrice', value: minPrice.value })"
                  placeholder="0 €"
              /></label>
              <label class="field"
                ><span>Precio hasta</span
                ><input
                  type="number"
                  min="0"
                  step="1"
                  [value]="filters().maxPrice ?? ''"
                  #maxPrice
                  (change)="numberFilterChanged.emit({ key: 'maxPrice', value: maxPrice.value })"
                  placeholder="Sin límite"
              /></label>
            </div>
          }
          @if (panel === 'type' || panel === 'more') {
            <label class="field"
              ><span>Tipo de evento</span>
              <select
                [value]="filters().eventType ?? ''"
                #eventType
                (change)="filtersChanged.emit({ eventType: eventType.value || undefined })"
              >
                <option value="" [selected]="!filters().eventType">Todos los tipos</option>
                @for (type of eventTypes; track type) {
                  <option [value]="type" [selected]="filters().eventType === type">
                    {{ label(type) }}
                  </option>
                }
              </select>
            </label>
          }
          @if (panel === 'atmosphere' || panel === 'more') {
            <label class="field"><span>Ambiente</span>
              <select [value]="filters().atmosphere ?? ''" #atmosphere
                (change)="filtersChanged.emit({ atmosphere: atmosphere.value || undefined })">
                <option value="">Todos los ambientes</option>
                @for (name of atmospheres; track name) { <option [value]="name">{{ label(name) }}</option> }
              </select>
            </label>
          }
          @if (panel === 'more') {
            <label class="field"><span>Ideal para</span>
              <select [value]="filters().idealFor ?? ''" #idealFor
                (change)="filtersChanged.emit({ idealFor: idealFor.value || undefined })">
                <option value="">Cualquier plan</option>
                @for (value of ideals; track value) { <option [value]="value">{{ label(value) }}</option> }
              </select>
            </label>
            <label class="field"><span>Código de vestimenta</span>
              <select [value]="filters().dressCode ?? ''" #dressCode
                (change)="filtersChanged.emit({ dressCode: dressCode.value || undefined })">
                <option value="">Cualquiera</option>
                @for (code of dressCodes; track code) { <option [value]="code">{{ label(code) }}</option> }
              </select>
            </label>
            @if (nearMe()) {
              <div class="field-pair">
                <label class="field"><span>Radio</span>
                  <select [value]="filters().radiusKm ?? 10" #radius
                    (change)="radiusChanged.emit(radius.value)">
                    <option value="2">2 km</option><option value="5">5 km</option><option value="10">10 km</option>
                    <option value="25">25 km</option><option value="50">50 km</option>
                  </select>
                </label>
                <label class="field"><span>Orden</span>
                  <select [value]="filters().sort" #sort (change)="sortChanged.emit(sort.value)">
                    <option value="date">Próximos</option><option value="price">Menor precio</option>
                    <option value="createdAt">Recientes</option><option value="distance">Más cerca</option>
                  </select>
                </label>
              </div>
            }
            <div class="field-pair">
              <label class="field"
                ><span>Desde el día</span
                ><input
                  type="date"
                  [value]="dateInputValue(filters().dateFrom)"
                  #dateFrom
                  (change)="dateFilterChanged.emit({ key: 'dateFrom', value: dateFrom.value })"
              /></label>
              <label class="field"
                ><span>Hasta el día</span
                ><input
                  type="date"
                  [value]="dateInputValue(filters().dateTo)"
                  #dateTo
                  (change)="dateFilterChanged.emit({ key: 'dateTo', value: dateTo.value })"
              /></label>
            </div>
            <div class="field-pair">
              <label class="field"
                ><span>Mi edad</span
                ><input
                  type="number"
                  min="0"
                  [value]="filters().minimumAge ?? ''"
                  #minimumAge
                  (change)="
                    numberFilterChanged.emit({ key: 'minimumAge', value: minimumAge.value })
                  "
                  placeholder="18"
              /></label>
              <label class="field"
                ><span>Estado</span>
                <select
                  [value]="filters().status ?? ''"
                  #status
                  (change)="filtersChanged.emit({ status: status.value || undefined })"
                >
                  <option value="">Publicados y agotados</option>
                  @for (value of statuses; track value) {
                    <option [value]="value" [selected]="filters().status === value">
                      {{ label(value) }}
                    </option>
                  }
                </select>
              </label>
            </div>
          }
        </div>
        <div class="filter-panel-actions">
          @if (hasActiveFilters()) {
            <button
              type="button"
              class="button-text"
              (click)="allFiltersCleared.emit(); closeFilterPanel()"
            >
              Limpiar filtros
            </button>
          }
          <button type="button" class="button-primary" (click)="closeFilterPanel()">
            Ver {{ total() }} {{ total() === 1 ? 'plan' : 'planes' }} <span>↗</span>
          </button>
        </div>
      </section>
    }
  `,
})
export class EventFiltersComponent {
  private readonly document = inject(DOCUMENT);
  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;
  private previousFocus: HTMLElement | null = null;
  readonly filters = input.required<EventFilters>();
  readonly nearMe = input(false);
  readonly municipalities = input<string[]>([]);
  readonly provinces = input<string[]>([]);
  readonly total = input(0);
  readonly hasActiveFilters = input(false);
  readonly filtersChanged = output<Partial<EventFilters>>();
  readonly numberFilterChanged = output<{
    key: 'minPrice' | 'maxPrice' | 'minimumAge';
    value: string;
  }>();
  readonly dateFilterChanged = output<{ key: 'dateFrom' | 'dateTo'; value: string }>();
  readonly allFiltersCleared = output<void>();
  readonly radiusChanged = output<string>();
  readonly sortChanged = output<string>();
  readonly activePanel = signal<EventFilterPanel | null>(null);
  readonly genres = EVENT_GENRES;
  readonly atmospheres = EVENT_ATMOSPHERES;
  readonly eventTypes = EVENT_TYPES;
  readonly dressCodes = EVENT_DRESS_CODES;
  readonly ideals = EVENT_IDEALS;
  readonly statuses = EVENT_STATUSES;
  readonly label = readableTag;
  constructor() {
    effect((onCleanup) => {
      if (!this.activePanel()) return;
      const previous = this.document.body.style.overflow;
      this.document.body.style.overflow = 'hidden';
      onCleanup(() => { this.document.body.style.overflow = previous; });
    });
  }
  toggleFilterPanel(panel: EventFilterPanel) {
    if (this.activePanel() === panel) { this.closeFilterPanel(); return; }
    if (!this.activePanel()) this.previousFocus = this.document.activeElement as HTMLElement;
    this.activePanel.set(panel);
    setTimeout(() => this.dialog?.nativeElement.querySelector<HTMLElement>('.icon-close')?.focus(), 0);
  }
  closeFilterPanel() {
    this.activePanel.set(null);
    this.previousFocus?.focus({ preventScroll: true });
    this.previousFocus = null;
  }
  filterPanelTitle(panel: EventFilterPanel) {
    return {
      music: 'Música',
      price: 'Precio',
      type: 'Tipo de evento',
      atmosphere: 'Ambiente',
      more: 'Todos los filtros',
    }[panel];
  }
  dateInputValue(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  @HostListener('document:keydown.escape') onEscape() {
    if (this.activePanel()) this.closeFilterPanel();
  }
  @HostListener('document:keydown', ['$event']) onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !this.activePanel() || !this.dialog) return;
    const controls = [...this.dialog.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled])')];
    if (!controls.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && this.document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && this.document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
}

import { DOCUMENT } from '@angular/common';
import {
  Component, ElementRef, HostListener, effect, inject, input, output, signal, ViewChild,
} from '@angular/core';
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
  templateUrl: './event-filters.html',
})
export class EventFiltersComponent {
  private readonly document = inject(DOCUMENT);
  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;
  private previousFocus: HTMLElement | null = null;

  // Inputs describe the current selection; outputs let the page own URL changes.
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
      onCleanup(() => {
        this.document.body.style.overflow = previous;
      });
    });
  }

  // Modal lifecycle also restores focus to the filter button on close.
  toggleFilterPanel(panel: EventFilterPanel) {
    if (this.activePanel() === panel) {
      this.closeFilterPanel();
      return;
    }
    if (!this.activePanel()) this.previousFocus = this.document.activeElement as HTMLElement;
    this.activePanel.set(panel);
    setTimeout(
      () => this.dialog?.nativeElement.querySelector<HTMLElement>('.icon-close')?.focus(),
      0,
    );
  }

  closeFilterPanel() {
    this.activePanel.set(null);
    this.previousFocus?.focus({ preventScroll: true });
    this.previousFocus = null;
  }

  // Template-only presentation helpers.
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
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  // Keyboard support: Escape closes the modal and Tab remains inside it.
  @HostListener('document:keydown.escape') onEscape() {
    if (this.activePanel()) this.closeFilterPanel();
  }
  @HostListener('document:keydown', ['$event']) onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !this.activePanel() || !this.dialog) return;
    const controls = [
      ...this.dialog.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled])',
      ),
    ];
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

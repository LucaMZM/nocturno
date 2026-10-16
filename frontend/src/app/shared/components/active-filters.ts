import { Component, computed, input, output } from '@angular/core';
import type { EventFilters } from '../../core/models/domain.model';
import { ActiveFilterKey, activeFilterChips } from '../utils/event-filter-contract';

@Component({
  selector: 'app-active-filters',
  template: `
    @if (chips().length) {
      <div class="active-filters" aria-label="Filtros activos">
        <span class="active-filters-label">APLICADOS</span>
        @for (chip of chips(); track chip.key) {
          <button
            type="button"
            (click)="removed.emit(chip.key)"
            [attr.aria-label]="'Quitar filtro ' + chip.label"
          >
            {{ chip.label }} <span aria-hidden="true">×</span>
          </button>
        }
        <button type="button" class="clear-all" (click)="cleared.emit()">Limpiar todo</button>
      </div>
    }
  `,
})
export class ActiveFiltersComponent {
  readonly filters = input.required<EventFilters>();
  readonly chips = computed(() => activeFilterChips(this.filters()));
  readonly removed = output<ActiveFilterKey>();
  readonly cleared = output<void>();
}

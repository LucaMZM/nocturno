import { Component, input, output } from '@angular/core';
import { DatePreset } from '../utils/format';

@Component({
  selector: 'app-quick-date-filters',
  template: `
    <div class="quick-dates" aria-label="Filtrar por fecha">
      <button type="button" [class.selected]="selected() === 'tonight'" (click)="chosen.emit('tonight')">Esta noche</button>
      <button type="button" [class.selected]="selected() === 'tomorrow'" (click)="chosen.emit('tomorrow')">Mañana</button>
      <button type="button" [class.selected]="selected() === 'weekend'" (click)="chosen.emit('weekend')">Este finde</button>
    </div>
  `
})
export class QuickDateFiltersComponent {
  readonly selected = input<DatePreset | null>(null);
  readonly chosen = output<DatePreset>();
}

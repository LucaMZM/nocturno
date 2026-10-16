import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-location-selector',
  template: `
    <label class="location-select">
      <span class="location-pin" aria-hidden="true">⌖</span>
      <span class="sr-only">Municipio</span>
      <select [value]="municipality()" (change)="changed.emit(select.value)" #select aria-label="Seleccionar municipio">
        <option value="" [selected]="municipality() === ''">Todas las localidades</option>
        @for (name of municipalities(); track name) { <option [value]="name" [selected]="municipality() === name">{{ name }}</option> }
      </select>
      <span aria-hidden="true">⌄</span>
    </label>
  `
})
export class LocationSelectorComponent {
  readonly municipality = input.required<string>();
  readonly municipalities = input.required<string[]>();
  readonly changed = output<string>();
}

import { Component, effect, input, OnDestroy, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

const SEARCH_DEBOUNCE_MS = 320;

@Component({
  selector: 'app-search-bar',
  imports: [ReactiveFormsModule],
  template: `
    <form class="search-bar" role="search" (submit)="submit($event)">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <label class="sr-only" for="event-search">Buscar eventos</label>
      <input
        id="event-search"
        type="search"
        [formControl]="control"
        (input)="queueSearch()"
        placeholder="Busca evento, club o artista…"
        autocomplete="off"
      />
      <button type="submit">Buscar <span aria-hidden="true">↗</span></button>
    </form>
  `,
})
export class SearchBarComponent implements OnDestroy {
  readonly initial = input('');
  readonly searched = output<string>();
  readonly control = new FormControl('', { nonNullable: true });
  private timer?: ReturnType<typeof setTimeout>;
  private lastEmitted = '';

  constructor() {
    effect(() => {
      const value = this.initial();
      this.lastEmitted = value;
      this.control.setValue(value, { emitEvent: false });
    });
  }
  queueSearch() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.emitSearch(), SEARCH_DEBOUNCE_MS);
  }
  submit(event: Event) {
    event.preventDefault();
    clearTimeout(this.timer);
    this.emitSearch();
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
  }
  private emitSearch() {
    const value = this.control.value.trim();
    if (value === this.lastEmitted) return;
    this.lastEmitted = value;
    this.searched.emit(value);
  }
}

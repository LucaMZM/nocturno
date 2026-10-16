import { Component, input, output } from '@angular/core';
import { Event } from '../../../core/models/domain.model';
import { EventCardComponent } from './event-card';

@Component({
  selector: 'app-event-grid',
  imports: [EventCardComponent],
  template: `
    <div class="event-grid">
      @for (event of events(); track event.id) {
        <app-event-card [event]="event" [isFavorite]="favoriteIds().has(event.id)" [favoritePending]="pendingIds().includes(event.id)" (favoriteClicked)="favoriteClicked.emit($event)" />
      }
    </div>
  `
})
export class EventGridComponent {
  readonly events = input.required<Event[]>();
  readonly favoriteIds = input.required<Set<string>>();
  readonly pendingIds = input<string[]>([]);
  readonly favoriteClicked = output<Event>();
}

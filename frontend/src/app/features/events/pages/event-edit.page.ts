import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventFormComponent } from '../components/event-form.component';

@Component({
  selector: 'app-event-edit-page',
  imports: [EventFormComponent, RouterLink],
  template: `
    <nav class="event-management-tabs page-width" aria-label="Gestión del evento">
      <a [routerLink]="['/dashboard/events', eventId, 'edit']">Evento</a>
      <a [routerLink]="['/dashboard/events', eventId, 'tickets']">Entradas</a>
      <a [routerLink]="['/dashboard/events', eventId, 'sales']">Ventas</a>
      <a [routerLink]="['/dashboard/events', eventId, 'attendees']">Asistentes</a>
    </nav>
    <app-event-form [eventId]="eventId" />
  `,
})
export class EventEditPage {
  readonly eventId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
}

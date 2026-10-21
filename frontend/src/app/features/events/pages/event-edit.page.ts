import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventEditorPage } from './event-editor.page';

@Component({
  selector: 'app-event-edit-page',
  imports: [EventEditorPage, RouterLink],
  template: `
    <nav class="event-management-tabs page-width" aria-label="Gestión del evento">
      <a [routerLink]="['/dashboard/events', eventId, 'edit']">Evento</a>
      <a [routerLink]="['/dashboard/events', eventId, 'tickets']">Entradas</a>
      <a [routerLink]="['/dashboard/events', eventId, 'sales']">Ventas</a>
      <a [routerLink]="['/dashboard/events', eventId, 'attendees']">Asistentes</a>
    </nav>
    <app-event-editor [eventId]="eventId" />
  `,
})
export class EventEditPage {
  readonly eventId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
}

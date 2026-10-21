import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventWritePayload } from '../../../core/models/domain.model';
import { EventFormComponent } from '../components/event-form.component';
import { EventEditorStore } from '../store/event-editor.store';

@Component({
  selector: 'app-event-edit-page',
  imports: [EventFormComponent, RouterLink],
  providers: [EventEditorStore],
  template: `
    <nav class="event-management-tabs page-width" aria-label="Gestión del evento">
      <a [routerLink]="['/dashboard/events', eventId, 'edit']">Evento</a>
      <a [routerLink]="['/dashboard/events', eventId, 'tickets']">Entradas</a>
      <a [routerLink]="['/dashboard/events', eventId, 'sales']">Ventas</a>
      <a [routerLink]="['/dashboard/events', eventId, 'attendees']">Asistentes</a>
    </nav>
    @if (ready()) {
      <app-event-form [eventId]="eventId" [saved]="saved()"
        (submitted)="save($event)" (reloadRequested)="load()" />
    } @else { <p class="page-width muted" role="status">Cargando formulario…</p> }
  `,
})
export class EventEditPage implements OnInit {
  readonly eventId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly editor = inject(EventEditorStore);
  readonly ready = signal(false);
  readonly saved = signal(false);

  ngOnInit() { void this.load(); }

  async load() {
    this.ready.set(false);
    this.saved.set(false);
    await this.editor.load(this.eventId);
    this.ready.set(true);
  }

  async save({ payload, galleryOnly }: { payload: EventWritePayload; galleryOnly: boolean }) {
    this.saved.set(false);
    if (await this.editor.save(this.eventId, payload, galleryOnly)) this.saved.set(true);
  }
}

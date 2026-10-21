import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EventWritePayload } from '../../../core/models/domain.model';
import { EventFormComponent } from '../components/event-form.component';
import { EventEditorStore } from '../store/event-editor.store';

@Component({
  selector: 'app-event-create-page',
  imports: [EventFormComponent],
  providers: [EventEditorStore],
  template: `@if (ready()) {
    <app-event-form (submitted)="save($event)" (reloadRequested)="load()" />
  } @else { <p class="page-width muted" role="status">Cargando formulario…</p> }`,
})
export class EventCreatePage implements OnInit {
  private readonly router = inject(Router);
  readonly editor = inject(EventEditorStore);
  readonly ready = signal(false);

  ngOnInit() { void this.load(); }

  async load() {
    this.ready.set(false);
    await this.editor.load(null);
    this.ready.set(true);
  }

  async save({ payload }: { payload: EventWritePayload; galleryOnly: boolean }) {
    const event = await this.editor.save(null, payload);
    if (event) void this.router.navigate(['/dashboard/events', event.id, 'edit']);
  }
}

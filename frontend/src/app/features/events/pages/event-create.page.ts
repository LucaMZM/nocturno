import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EventImageInput } from '../../../core/models/domain.model';
import { AuthStore } from '../../auth/store/auth.store';
import { EventFormValues } from '../utils/event-form.mapper';
import { EventFormComponent } from '../components/event-form.component';
import { EventEditorStore } from '../store/event-editor.store';

@Component({
  selector: 'app-event-create-page',
  imports: [EventFormComponent],
  providers: [EventEditorStore],
  template: `@if (ready()) {
    <app-event-form [event]="editor.event()" [venues]="editor.venues()"
      [promoters]="editor.promoters()" [maxImages]="editor.maxImages()"
      [error]="editor.error()" [saving]="editor.saving()"
      [isAdmin]="auth.user()?.role === 'ADMIN'"
      (submitted)="save($event)" (reloadRequested)="load()" />
  } @else { <p class="page-width muted" role="status">Cargando formulario…</p> }`,
})
export class EventCreatePage implements OnInit {
  private readonly router = inject(Router);
  readonly editor = inject(EventEditorStore);
  readonly auth = inject(AuthStore);
  readonly ready = signal(false);

  ngOnInit() { void this.load(); }

  async load() {
    this.ready.set(false);
    await this.editor.load(null);
    this.ready.set(true);
  }

  async save({ values, images }: { values: EventFormValues; images: EventImageInput[]; galleryOnly: boolean }) {
    const event = await this.editor.save(null, values, images);
    if (event) void this.router.navigate(['/dashboard/events', event.id, 'edit']);
  }
}

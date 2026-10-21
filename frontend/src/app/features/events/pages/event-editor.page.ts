import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { Event as NocturnoEvent } from '../../../core/models/domain.model';
import { AuthStore } from '../../auth/store/auth.store';
import { EventFormComponent, type EventFormDraft } from '../components/event-form.component';
import { EventEditorStore } from '../store/event-editor.store';
import { mapEventFormToPayload, prepareEventImages } from '../utils/event-form.mapper';

// La página coordina el caso de uso; el componente solo controla la interfaz.
@Component({
  selector: 'app-event-editor',
  imports: [EventFormComponent],
  providers: [EventEditorStore],
  template: `
    <app-event-form
      [eventId]="eventId()"
      [event]="editor.event()"
      [venues]="editor.venues()"
      [promoters]="editor.promoters()"
      [canChoosePromoter]="auth.user()?.role === 'ADMIN'"
      [maxImages]="editor.maxImages()"
      [loading]="editor.loading()"
      [saving]="editor.saving()"
      [ready]="ready()"
      [saved]="saved()"
      [serverError]="editor.error()"
      [submissionError]="submissionError()"
      (retryRequested)="load()"
      (submitted)="save($event)"
    />
  `,
})
export class EventEditorPage implements OnInit {
  readonly eventId = input<string | null>(null);
  readonly eventSaved = output<NocturnoEvent>();
  readonly editor = inject(EventEditorStore);
  readonly auth = inject(AuthStore);
  readonly ready = signal(false);
  readonly saved = signal(false);
  readonly submissionError = signal<string | null>(null);

  ngOnInit() { void this.load(); }

  async load() {
    this.ready.set(false);
    await this.editor.load(this.eventId());
    this.ready.set(true);
  }

  async save(draft: EventFormDraft) {
    if (this.editor.saving()) return;
    this.saved.set(false);
    this.submissionError.set(null);
    const gallery = prepareEventImages(draft.images, this.editor.maxImages());
    if (gallery.error) {
      this.submissionError.set(gallery.error);
      return;
    }
    const event = await this.editor.save(this.eventId(),
      mapEventFormToPayload(draft.values, gallery.images));
    if (!event) return;
    this.saved.set(true);
    this.eventSaved.emit(event);
  }
}

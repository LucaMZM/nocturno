import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Event } from '../../../core/models/domain.model';
import { EventEditorPage } from './event-editor.page';

@Component({
  selector: 'app-event-create-page',
  imports: [EventEditorPage],
  template: '<app-event-editor (eventSaved)="created($event)" />',
})
export class EventCreatePage {
  private readonly router = inject(Router);
  created(event: Event) {
    void this.router.navigate(['/dashboard/events', event.id, 'edit']);
  }
}

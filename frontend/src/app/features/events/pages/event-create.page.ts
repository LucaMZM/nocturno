import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Event } from '../../../core/models/domain.model';
import { EventFormComponent } from '../components/event-form.component';

@Component({
  selector: 'app-event-create-page',
  imports: [EventFormComponent],
  template: '<app-event-form (eventSaved)="created($event)" />',
})
export class EventCreatePage {
  private readonly router = inject(Router);
  created(event: Event) {
    void this.router.navigate(['/dashboard/events', event.id, 'edit']);
  }
}

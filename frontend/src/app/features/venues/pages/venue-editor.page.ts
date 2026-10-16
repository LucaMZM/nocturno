import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VenueFormComponent, VenuePayload } from '../components/venue-form.component';
import { VenuesStore } from '../store/venues.store';

@Component({
  selector: 'app-venue-editor-page',
  providers: [VenuesStore],
  imports: [VenueFormComponent, RouterLink],
  template: `
    <a class="back-link" routerLink="/dashboard/venues">← Locales</a>
    <div class="dashboard-heading"><p class="eyebrow">ESPACIOS</p><h2>{{ id ? 'Editar local' : 'Crear local' }}<span>.</span></h2></div>
    @if (store.loading()) { <p role="status">Cargando local…</p> }
    @if (store.error()) { <p class="inline-alert" role="alert">{{ store.error() }}</p> }
    @if (!store.loading()) { <app-venue-form [venue]="store.selected()" (submitted)="save($event)" /> }
  `,
})
export class VenueEditorPage implements OnInit {
  readonly store = inject(VenuesStore);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  private readonly router = inject(Router);
  ngOnInit() { if (this.id) void this.store.loadOne(this.id); }
  async save(payload: VenuePayload) { const saved = await this.store.save(this.id, payload);
    if (saved) await this.router.navigateByUrl('/dashboard/venues'); }
}

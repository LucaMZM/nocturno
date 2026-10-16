import { Component, inject, OnInit } from '@angular/core';
import { AuthStore } from '../../auth/store/auth.store';
import { PromoterFormComponent, PromoterPayload } from '../components/promoter-form.component';
import { PromotersStore } from '../store/promoters.store';

@Component({
  selector: 'app-promoter-profile-page',
  providers: [PromotersStore],
  imports: [PromoterFormComponent],
  template: `
    <div class="dashboard-heading"><p class="eyebrow">ORGANIZACIÓN</p><h2>Tu perfil<span>.</span></h2></div>
    @if (store.loading()) { <p role="status">Cargando perfil…</p> }
    @if (store.error()) { <p class="inline-alert" role="alert">{{ store.error() }}</p> }
    @if (saved) { <p class="editor-notice success" role="status">Perfil guardado.</p> }
    @if (store.selected(); as promoter) { <app-promoter-form [promoter]="promoter" (submitted)="save($event)" /> }
  `,
})
export class PromoterProfilePage implements OnInit {
  readonly store = inject(PromotersStore);
  private readonly auth = inject(AuthStore);
  saved = false;
  ngOnInit() { const id = this.auth.user()?.promoterId; if (id) void this.store.loadOne(id); }
  async save(payload: PromoterPayload) {
    const id = this.auth.user()?.promoterId;
    if (id) this.saved = !!(await this.store.save(id, payload));
  }
}

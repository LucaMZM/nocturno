import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PromoterFormComponent, PromoterPayload } from '../components/promoter-form.component';
import { PromotersStore } from '../store/promoters.store';

@Component({
  selector: 'app-promoter-editor-page',
  providers: [PromotersStore],
  imports: [PromoterFormComponent, RouterLink],
  template: `
    <a class="back-link" routerLink="/dashboard/promoters">← Promotores</a>
    <div class="dashboard-heading"><p class="eyebrow">ORGANIZADORES</p><h2>{{ id ? 'Editar promotor' : 'Crear promotor' }}<span>.</span></h2></div>
    @if (store.loading()) { <p role="status">Cargando promotor…</p> }
    @if (store.error()) { <p class="inline-alert" role="alert">{{ store.error() }}</p> }
    @if (!store.loading()) { <app-promoter-form [promoter]="store.selected()" (submitted)="save($event)" /> }
  `,
})
export class PromoterEditorPage implements OnInit {
  readonly store = inject(PromotersStore);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  private readonly router = inject(Router);
  ngOnInit() { if (this.id) void this.store.loadOne(this.id); }
  async save(payload: PromoterPayload) { const saved = await this.store.save(this.id, payload);
    if (saved) await this.router.navigateByUrl('/dashboard/promoters'); }
}

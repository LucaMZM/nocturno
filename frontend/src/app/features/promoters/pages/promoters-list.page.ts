import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PromotersStore } from '../store/promoters.store';

@Component({
  selector: 'app-promoters-list-page',
  providers: [PromotersStore],
  imports: [RouterLink],
  template: `
    <div class="dashboard-heading row-between"><div><p class="eyebrow">ORGANIZADORES</p><h2>Promotores<span>.</span></h2></div>
      <a class="button-primary" routerLink="/dashboard/promoters/create">Crear promotor <span>＋</span></a></div>
    @if (store.loading()) { <p role="status">Cargando promotores…</p> }
    @if (store.error()) { <p class="inline-alert" role="alert">{{ store.error() }}</p> }
    @if (!store.loading() && !store.promoters().length) { <p class="muted">Todavía no hay promotores.</p> }
    <div class="management-table-wrap"><table class="management-table"><thead><tr>
      <th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Web</th><th>Acción</th>
    </tr></thead><tbody>
      @for (promoter of store.promoters(); track promoter.id) { <tr>
        <td><strong>{{ promoter.name }}</strong></td><td>{{ promoter.email || '—' }}</td>
        <td>{{ promoter.phone || '—' }}</td><td>{{ promoter.websiteUrl || '—' }}</td>
        <td><a [routerLink]="['/dashboard/promoters', promoter.id, 'edit']">Editar</a>
          <button class="text-action danger" type="button" [disabled]="store.saving()" (click)="remove(promoter.id, promoter.name)">Eliminar</button></td>
      </tr> }
    </tbody></table></div>
    <div class="pagination-actions"><button class="button-outline" [disabled]="store.pagination().page <= 1" (click)="page(-1)">Anterior</button>
      <span>Página {{ store.pagination().page }} de {{ store.pagination().totalPages || 1 }}</span>
      <button class="button-outline" [disabled]="store.pagination().page >= store.pagination().totalPages" (click)="page(1)">Siguiente</button></div>
  `,
})
export class PromotersListPage implements OnInit {
  readonly store = inject(PromotersStore);
  ngOnInit() { void this.store.load(); }
  page(delta: number) { void this.store.load(this.store.pagination().page + delta); }
  async remove(id: string, name: string) {
    if (!confirm(`¿Eliminar el promotor «${name}»?`)) return;
    if (await this.store.remove(id)) await this.store.load(this.store.pagination().page);
  }
}

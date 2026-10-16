import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VenuesStore } from '../store/venues.store';

@Component({
  selector: 'app-venues-list-page',
  providers: [VenuesStore],
  imports: [RouterLink],
  template: `
    <div class="dashboard-heading row-between"><div><p class="eyebrow">ESPACIOS</p><h2>Locales<span>.</span></h2></div>
      <a class="button-primary" routerLink="/dashboard/venues/create">Crear local <span>＋</span></a></div>
    @if (store.loading()) { <p role="status">Cargando locales…</p> }
    @if (store.error()) { <p class="inline-alert" role="alert">{{ store.error() }}</p> }
    @if (!store.loading() && !store.venues().length) { <p class="muted">Todavía no hay locales.</p> }
    <div class="management-table-wrap"><table class="management-table"><thead><tr>
      <th>Nombre</th><th>Tipo</th><th>Municipio</th><th>Provincia</th><th>Dirección</th><th>Acción</th>
    </tr></thead><tbody>
      @for (venue of store.venues(); track venue.id) { <tr>
        <td><strong>{{ venue.name }}</strong></td><td>{{ venue.type }}</td><td>{{ venue.municipality }}</td>
        <td>{{ venue.province }}</td><td>{{ venue.address }}</td>
        <td><a [routerLink]="['/dashboard/venues', venue.id, 'edit']">Editar</a>
          <button class="text-action danger" type="button" [disabled]="store.saving()" (click)="remove(venue.id, venue.name)">Eliminar</button></td>
      </tr> }
    </tbody></table></div>
    <div class="pagination-actions"><button class="button-outline" [disabled]="store.pagination().page <= 1" (click)="page(-1)">Anterior</button>
      <span>Página {{ store.pagination().page }} de {{ store.pagination().totalPages || 1 }}</span>
      <button class="button-outline" [disabled]="store.pagination().page >= store.pagination().totalPages" (click)="page(1)">Siguiente</button></div>
  `,
})
export class VenuesListPage implements OnInit {
  readonly store = inject(VenuesStore);
  ngOnInit() { void this.store.load(); }
  page(delta: number) { void this.store.load(this.store.pagination().page + delta); }
  async remove(id: string, name: string) {
    if (!confirm(`¿Eliminar el local «${name}»?`)) return;
    if (await this.store.remove(id)) await this.store.load(this.store.pagination().page);
  }
}

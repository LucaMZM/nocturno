import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Promoter, User } from '../../../core/models/domain.model';
import { PromotersApiService } from '../../../core/services/promoters-api.service';
import { UsersStore } from '../store/users.store';
import { statusLabel, statusTone } from '../../../shared/utils/status-presentation';

@Component({
  selector: 'app-admin-users-page',
  providers: [UsersStore],
  imports: [ReactiveFormsModule, FormsModule],
  template: `
    <div class="dashboard-heading"><p class="eyebrow">ACCESO</p><h2>Usuarios<span>.</span></h2></div>
    <form class="management-filters" (ngSubmit)="searchUsers()">
      <label>Buscar <input name="search" [(ngModel)]="query" placeholder="Nombre o correo" /></label>
      <label>Rol <select name="role" [(ngModel)]="role"><option value="">Todos</option>
        <option value="USER">Usuario</option><option value="PROMOTER">Promotor</option>
        <option value="ADMIN">Administrador</option></select></label>
      <button class="button-outline">Filtrar</button>
    </form>
    @if (store.loading()) { <p role="status">Cargando usuarios…</p> }
    @if (store.error()) { <p class="inline-alert" role="alert">{{ store.error() }}</p> }
    @if (!store.loading() && !store.error() && !store.users().length) { <p class="muted">No hay usuarios con estos filtros.</p> }
    <div class="management-table-wrap"><table class="management-table"><thead><tr>
      <th>Nombre</th><th>Correo</th><th>Rol</th><th>Activo</th><th>Acción</th>
    </tr></thead><tbody>
      @for (user of store.users(); track user.id) { <tr>
        <td>{{ user.displayName }}</td><td>{{ user.email }}</td><td><span class="state-badge state-neutral">{{ label(user.role) }}</span></td>
        <td><span [class]="'state-badge state-' + tone(user.isActive ? 'ACTIVE' : 'INACTIVE')">{{ label(user.isActive ? 'ACTIVE' : 'INACTIVE') }}</span></td>
        <td><button class="text-action" (click)="edit(user)">Editar</button></td>
      </tr> }
    </tbody></table></div>
    <div class="pagination-actions"><button class="button-outline" [disabled]="store.pagination().page <= 1" (click)="page(-1)">Anterior</button>
      <span>Página {{ store.pagination().page }} de {{ store.pagination().totalPages || 1 }}</span>
      <button class="button-outline" [disabled]="store.pagination().page >= store.pagination().totalPages" (click)="page(1)">Siguiente</button></div>
    <section class="editor-panel management-form"><h3>{{ editingId() ? 'Editar usuario' : 'Crear usuario' }}</h3>
      <form [formGroup]="form" (ngSubmit)="save()" class="editor-fields">
        <label>Nombre * <input formControlName="displayName" required maxlength="120" /></label>
        <label>Correo * <input type="email" formControlName="email" required /></label>
        @if (!editingId()) { <label>Contraseña temporal * <input type="password" formControlName="password" minlength="12" required /></label> }
        <label>Rol <select formControlName="role"><option value="USER">Usuario</option>
          <option value="PROMOTER">Promotor</option><option value="ADMIN">Administrador</option></select></label>
        @if (form.controls.role.value === 'PROMOTER') { <label>Promotor asociado *
          <select formControlName="promoterId"><option value="">Selecciona</option>
            @for (promoter of promoters(); track promoter.id) { <option [value]="promoter.id">{{ promoter.name }}</option> }
          </select></label> }
        @if (editingId()) { <label class="editor-toggle"><input type="checkbox" formControlName="isActive" /> Cuenta activa</label> }
        <div class="editor-actions editor-wide"><button class="button-primary" [disabled]="store.saving()" type="submit">{{ editingId() ? 'Guardar cambios' : 'Crear usuario' }}</button>
          @if (editingId()) { <button class="button-outline" type="button" (click)="reset()">Cancelar</button> }</div>
      </form>
    </section>
  `,
})
export class AdminUsersPage implements OnInit {
  readonly store = inject(UsersStore);
  readonly label = statusLabel;
  readonly tone = statusTone;
  private readonly promotersApi = inject(PromotersApiService);
  private readonly builder = inject(FormBuilder);
  readonly editingId = signal<string | null>(null);
  readonly query = signal('');
  readonly role = signal('');
  readonly promoters = signal<Promoter[]>([]);
  readonly form = this.builder.nonNullable.group({
    displayName: ['', Validators.required], email: ['', [Validators.required, Validators.email]],
    password: [''], role: ['USER'], promoterId: [''], isActive: [true]
  });
  ngOnInit() { void this.store.loadUsers(); void this.loadPromoters(); }
  async loadPromoters() {
    const first = await this.promotersApi.getPromoters(1, 100);
    const rest = await Promise.all(Array.from({ length: first.pagination.totalPages - 1 }, (_, i) =>
      this.promotersApi.getPromoters(i + 2, 100)));
    this.promoters.set([first, ...rest].flatMap((page) => page.data));
  }
  edit(user: User) {
    this.editingId.set(user.id);
    this.form.setValue({ displayName: user.displayName, email: user.email, password: '',
      role: user.role, promoterId: user.promoterId ?? '', isActive: user.isActive });
  }
  reset() { this.editingId.set(null); this.form.reset(); }
  searchUsers() { void this.store.loadUsers(1, this.query(), this.role()); }
  page(delta: number) { void this.store.loadUsers(this.store.pagination().page + delta, this.query(), this.role()); }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    if (value.role === 'PROMOTER' && !value.promoterId) return;
    if (!this.editingId() && value.password.length < 12) return;
    const payload = { displayName: value.displayName.trim(), email: value.email.trim().toLowerCase(),
      role: value.role, promoterId: value.role === 'PROMOTER' ? value.promoterId : null,
      ...(this.editingId() ? { isActive: value.isActive } : { password: value.password }) };
    if (await this.store.saveUser(this.editingId(), payload)) {
      this.reset(); await this.store.loadUsers(this.store.pagination().page, this.query(), this.role());
    }
  }
}

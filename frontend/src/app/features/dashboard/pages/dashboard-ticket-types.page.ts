import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TicketType } from '../../../core/models/domain.model';
import { TicketTypesApiService } from '../../../core/services/ticket-types-api.service';
import { toApiProblem } from '../../../shared/utils/api-error';

@Component({
  selector: 'app-dashboard-ticket-types-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <a class="back-link" routerLink="/dashboard/events">← Eventos</a>
    <div class="dashboard-heading"><p class="eyebrow">INVENTARIO</p><h2>Entradas<span>.</span></h2></div>
    @if (error()) { <p class="inline-alert" role="alert">{{ error() }}</p> }
    @if (loading()) { <p role="status">Cargando entradas…</p> }
    @if (!loading() && !error() && !tickets().length) { <p class="muted">Aún no hay tipos de entrada.</p> }
    <div class="management-table-wrap"><table class="management-table"><thead><tr>
      <th>Nombre</th><th>Precio</th><th>Disponibles</th><th>Vendidas</th><th>Reservadas</th><th>Estado</th><th>Acciones</th>
    </tr></thead><tbody>
      @for (ticket of tickets(); track ticket.id) { <tr>
        <td><strong>{{ ticket.name }}</strong><div class="ticket-progress" role="progressbar" [attr.aria-valuenow]="ticket.sold" [attr.aria-valuemax]="ticket.quantity" aria-valuemin="0" [attr.aria-label]="ticket.name + ': entradas vendidas'"><span [style.width.%]="progress(ticket)"></span></div><small>{{ ticket.sold }} / {{ ticket.quantity }} vendidas</small></td><td>{{ euros(ticket.price) }}</td>
        <td>{{ ticket.quantity - ticket.sold - ticket.reserved }}</td><td>{{ ticket.sold }}</td>
        <td>{{ ticket.reserved }}</td><td>{{ ticket.quantity - ticket.sold - ticket.reserved <= 0 ? 'Agotada' : ticket.active ? 'Activa' : 'Inactiva' }}</td>
        <td><button class="text-action" (click)="edit(ticket)">Editar</button>
          <button class="text-action" [disabled]="busy()" (click)="toggle(ticket)">{{ ticket.active ? 'Desactivar' : 'Activar' }}</button>
          <button class="text-action danger" [disabled]="busy() || ticket.sold + ticket.reserved > 0" (click)="remove(ticket)">Eliminar</button></td>
      </tr> }
    </tbody></table></div>
    <section class="editor-panel management-form">
      <h3>{{ editingId() ? 'Editar tipo de entrada' : 'Crear tipo de entrada' }}</h3>
      <form [formGroup]="form" (ngSubmit)="save()" class="editor-fields">
        <label>Nombre * <input formControlName="name" maxlength="120" required /></label>
        <label>Precio (€) * <input type="number" formControlName="price" min="0" step="0.01" required /></label>
        <label>Capacidad * <input type="number" formControlName="quantity" min="0" step="1" required /></label>
        <label>Máximo por persona <input type="number" formControlName="maxPerUser" min="1" step="1" /></label>
        <label>Venta desde <input type="datetime-local" formControlName="salesStart" /></label>
        <label>Venta hasta <input type="datetime-local" formControlName="salesEnd" /></label>
        <label class="editor-wide">Ventajas, una por línea <textarea formControlName="benefits" rows="3"></textarea></label>
        <label class="editor-toggle"><input type="checkbox" formControlName="active" /> Activa</label>
        <div class="editor-actions editor-wide">
          <button class="button-primary" type="submit" [disabled]="busy()">{{ busy() ? 'Guardando…' : editingId() ? 'Guardar cambios' : 'Crear entrada' }}</button>
          @if (editingId()) { <button class="button-outline" type="button" (click)="reset()">Cancelar</button> }
        </div>
      </form>
    </section>
  `,
})
export class DashboardTicketTypesPage implements OnInit {
  private readonly api = inject(TicketTypesApiService);
  private readonly builder = inject(FormBuilder);
  readonly eventId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly tickets = signal<TicketType[]>([]);
  readonly editingId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.builder.nonNullable.group({
    name: ['', Validators.required], price: [0, [Validators.required, Validators.min(0)]],
    quantity: [0, [Validators.required, Validators.min(0)]], maxPerUser: [''],
    salesStart: [''], salesEnd: [''], benefits: [''], active: [true]
  });
  ngOnInit() { void this.load(); }
  async load() {
    this.loading.set(true);
    try { this.tickets.set((await this.api.getByEvent(this.eventId)).data); this.error.set(null); }
    catch (error) { this.error.set(toApiProblem(error, 'No hemos podido cargar las entradas.').message); }
    finally { this.loading.set(false); }
  }
  edit(ticket: TicketType) {
    this.editingId.set(ticket.id);
    this.form.setValue({ name: ticket.name, price: ticket.price, quantity: ticket.quantity,
      maxPerUser: ticket.maxPerUser?.toString() ?? '',
      salesStart: ticket.salesStart ? this.localDate(ticket.salesStart) : '',
      salesEnd: ticket.salesEnd ? this.localDate(ticket.salesEnd) : '',
      benefits: ticket.benefits.join('\n'), active: ticket.active });
  }
  reset() { this.editingId.set(null); this.form.reset(); }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) { this.error.set('Revisa los campos obligatorios.'); return; }
    const value = this.form.getRawValue();
    const payload = { name: value.name.trim(), price: Number(value.price), quantity: Number(value.quantity),
      maxPerUser: value.maxPerUser ? Number(value.maxPerUser) : null,
      salesStart: value.salesStart ? new Date(value.salesStart).toISOString() : null,
      salesEnd: value.salesEnd ? new Date(value.salesEnd).toISOString() : null,
      benefits: value.benefits.split('\n').map((item) => item.trim()).filter(Boolean), active: value.active };
    if (payload.salesStart && payload.salesEnd && payload.salesEnd <= payload.salesStart) {
      this.error.set('La venta debe terminar después de comenzar.'); return;
    }
    this.busy.set(true);
    try {
      if (this.editingId()) await this.api.update(this.editingId()!, payload);
      else await this.api.create(this.eventId, payload);
      this.reset(); await this.load();
    } catch (error) { this.error.set(toApiProblem(error, 'No hemos podido guardar la entrada.').message); }
    finally { this.busy.set(false); }
  }
  async toggle(ticket: TicketType) {
    this.busy.set(true);
    try { await this.api.update(ticket.id, { active: !ticket.active }); await this.load(); }
    catch (error) { this.error.set(toApiProblem(error, 'No hemos podido cambiar el estado.').message); }
    finally { this.busy.set(false); }
  }
  async remove(ticket: TicketType) {
    if (!confirm(`¿Eliminar la entrada «${ticket.name}»?`)) return;
    this.busy.set(true);
    try { await this.api.remove(ticket.id); await this.load(); }
    catch (error) { this.error.set(toApiProblem(error, 'No hemos podido eliminar la entrada.').message); }
    finally { this.busy.set(false); }
  }
  euros(value: number) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value); }
  progress(ticket: TicketType) { return ticket.quantity ? Math.min(100, 100 * ticket.sold / ticket.quantity) : 0; }
  private localDate(iso: string) {
    const date = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}

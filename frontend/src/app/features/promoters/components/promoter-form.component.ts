import { Component, inject, Input, OnChanges, Output, EventEmitter } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Promoter } from '../../../core/models/domain.model';

export interface PromoterPayload { name: string; description: string | null;
  email: string | null; phone: string | null; websiteUrl: string | null; }
@Component({
  selector: 'app-promoter-form',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="editor-form">
      <section class="editor-panel"><h3>Datos del promotor</h3><div class="editor-fields">
        <label>Nombre * <input formControlName="name" maxlength="160" required /></label>
        <label>Correo <input type="email" formControlName="email" maxlength="320" /></label>
        <label>Teléfono <input type="tel" formControlName="phone" maxlength="40" /></label>
        <label>Web <input type="url" formControlName="websiteUrl" placeholder="https://…" /></label>
        <label class="editor-wide">Descripción <textarea formControlName="description" rows="4" maxlength="5000"></textarea></label>
      </div></section>
      @if (form.invalid && form.touched) { <p class="inline-alert" role="alert">Revisa los campos.</p> }
      <button class="button-primary" type="submit">{{ promoter ? 'Guardar cambios' : 'Crear promotor' }} <span>↗</span></button>
    </form>
  `,
})
export class PromoterFormComponent implements OnChanges {
  @Input() promoter: Promoter | null = null;
  @Output() submitted = new EventEmitter<PromoterPayload>();
  private readonly builder = inject(FormBuilder);
  readonly form = this.builder.nonNullable.group({
    name: ['', Validators.required], description: [''], email: ['', Validators.email],
    phone: [''], websiteUrl: ['', Validators.pattern(/^$|^https?:\/\/[^\s]+$/i)]
  });
  ngOnChanges() {
    const promoter = this.promoter;
    if (!promoter) return;
    this.form.setValue({ name: promoter.name, description: promoter.description ?? '',
      email: promoter.email ?? '', phone: promoter.phone ?? '', websiteUrl: promoter.websiteUrl ?? '' });
  }
  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const optional = (text: string) => text.trim() || null;
    this.submitted.emit({ name: value.name.trim(), description: optional(value.description),
      email: optional(value.email), phone: optional(value.phone), websiteUrl: optional(value.websiteUrl) });
  }
}

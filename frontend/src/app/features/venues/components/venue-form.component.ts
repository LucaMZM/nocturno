import { Component, inject, Input, OnChanges, Output, EventEmitter } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Venue } from '../../../core/models/domain.model';

export interface VenuePayload {
  name: string; description: string | null; type: string; province: string;
  municipality: string; zone: string | null; address: string; postalCode: string | null;
  latitude: number | null; longitude: number | null; capacity: number | null;
  minimumAge: number | null; websiteUrl: string | null; imageUrl: string | null;
}
const types = ['CLUB','DISCOTHEQUE','BAR','PUB','ROOFTOP','BEACH_CLUB','CONCERT_HALL','FESTIVAL_SITE','OUTDOOR','OTHER'];

@Component({
  selector: 'app-venue-form',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="editor-form">
      <section class="editor-panel"><h3>Identidad y ubicación</h3><div class="editor-fields">
        <label>Nombre * <input formControlName="name" maxlength="160" required /></label>
        <label>Tipo * <select formControlName="type" required><option value="">Selecciona</option>
          @for (type of types; track type) { <option [value]="type">{{ type.replaceAll('_', ' ') }}</option> }
        </select></label>
        <label>Provincia * <input formControlName="province" maxlength="120" required /></label>
        <label>Municipio * <input formControlName="municipality" maxlength="120" required /></label>
        <label>Zona <input formControlName="zone" maxlength="120" /></label>
        <label>Dirección * <input formControlName="address" maxlength="240" required /></label>
        <label>Código postal <input formControlName="postalCode" inputmode="numeric" maxlength="5" placeholder="46001" /></label>
        <label class="editor-wide">Descripción <textarea formControlName="description" maxlength="5000" rows="4"></textarea></label>
      </div></section>
      <section class="editor-panel"><h3>Aforo y presencia</h3><div class="editor-fields">
        <label>Aforo <input type="number" min="0" step="1" formControlName="capacity" /></label>
        <label>Edad mínima <input type="number" min="0" step="1" formControlName="minimumAge" /></label>
        <label>Latitud <input type="number" min="-90" max="90" step="any" formControlName="latitude" /></label>
        <label>Longitud <input type="number" min="-180" max="180" step="any" formControlName="longitude" /></label>
        <label>Web <input type="url" formControlName="websiteUrl" placeholder="https://…" /></label>
        <label>Imagen <input type="url" formControlName="imageUrl" placeholder="https://…" /></label>
      </div></section>
      @if (form.invalid && form.touched) { <p class="inline-alert" role="alert">Revisa los campos obligatorios y los valores.</p> }
      <button class="button-primary" type="submit">{{ venue ? 'Guardar cambios' : 'Crear local' }} <span>↗</span></button>
    </form>
  `,
})
export class VenueFormComponent implements OnChanges {
  @Input() venue: Venue | null = null;
  @Output() submitted = new EventEmitter<VenuePayload>();
  readonly types = types;
  private readonly builder = inject(FormBuilder);
  readonly form = this.builder.nonNullable.group({
    name: ['', Validators.required], description: [''], type: ['', Validators.required],
    province: ['', Validators.required], municipality: ['', Validators.required], zone: [''],
    address: ['', Validators.required], postalCode: ['', Validators.pattern(/^$|^[0-9]{5}$/)],
    latitude: [''], longitude: [''], capacity: [''],
    minimumAge: [''], websiteUrl: ['', Validators.pattern(/^$|^https?:\/\/[^\s]+$/i)],
    imageUrl: ['', Validators.pattern(/^$|^https?:\/\/[^\s]+$/i)]
  });
  ngOnChanges() {
    const venue = this.venue;
    if (!venue) return;
    this.form.setValue({ name: venue.name, description: venue.description ?? '', type: venue.type,
      province: venue.province, municipality: venue.municipality, zone: venue.zone ?? '',
      address: venue.address, postalCode: venue.postalCode ?? '', latitude: venue.latitude?.toString() ?? '',
      longitude: venue.longitude?.toString() ?? '', capacity: venue.capacity?.toString() ?? '',
      minimumAge: venue.minimumAge?.toString() ?? '', websiteUrl: venue.websiteUrl ?? '',
      imageUrl: venue.imageUrl ?? '' });
  }
  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const optional = (text: string) => text.trim() || null;
    const numeric = (text: string) => text === '' ? null : Number(text);
    this.submitted.emit({ name: value.name.trim(), description: optional(value.description),
      type: value.type, province: value.province.trim(), municipality: value.municipality.trim(),
      zone: optional(value.zone), address: value.address.trim(), postalCode: optional(value.postalCode), latitude: numeric(value.latitude),
      longitude: numeric(value.longitude), capacity: numeric(value.capacity),
      minimumAge: numeric(value.minimumAge), websiteUrl: optional(value.websiteUrl), imageUrl: optional(value.imageUrl) });
  }
}

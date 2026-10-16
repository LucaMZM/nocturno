import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Event as NocturnoEvent } from '../../../core/models/domain.model';
import { ErrorStateComponent } from '../../../shared/components/states';
import { readableTag } from '../../../shared/utils/format';
import { EventEditorStore } from '../store/event-editor.store';
import { EventsStore } from '../store/events.store';
import { AuthStore } from '../../auth/store/auth.store';

const eventTypes = [
  'CLUB',
  'RAVE',
  'CONCERT',
  'FESTIVAL',
  'ROOFTOP',
  'BEACH_CLUB',
  'BOAT_PARTY',
  'PUB',
  'AFTER',
  'JAZZ_CLUB',
  'LIVE_SESSION',
  'OTHER',
];
const statuses = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'SOLD_OUT',
  'CANCELLED',
  'FINISHED',
  'REJECTED',
];
const genres = [
  'TECHNO',
  'HARD_TECHNO',
  'HARDGROOVE',
  'HOUSE',
  'TECH_HOUSE',
  'EDM',
  'REGGAETON',
  'LATIN',
  'HIP_HOP',
  'TRAP',
  'POP',
  'INDIE',
  'ROCK',
  'JAZZ',
  'SOUL',
  'LIVE',
];
const atmospheres = [
  'UNDERGROUND',
  'COMMERCIAL',
  'UNIVERSITY',
  'ELEGANT',
  'INTERNATIONAL',
  'ALTERNATIVE',
  'CHILL',
];
const ideals = ['FRIENDS', 'MEETING_PEOPLE', 'DANCING', 'DATE', 'GROUPS', 'CELEBRATIONS', 'DRINKS'];
const dressCodes = ['CASUAL', 'SMART_CASUAL', 'ELEGANT', 'STREETWEAR', 'NO_DRESS_CODE'];
type SelectionField = 'musicGenres' | 'atmosphere' | 'idealFor';

function localDateTime(iso: string): string {
  const date = new Date(iso);
  const twoDigits = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}T${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

@Component({
  selector: 'app-event-form',
  imports: [ReactiveFormsModule, RouterLink, ErrorStateComponent],
  providers: [EventEditorStore],
  template: `
    <main class="page-width editor-page">
      <a routerLink="/dashboard/events" class="back-link">← Volver a eventos</a>
      <div class="editor-heading">
        <p class="eyebrow">GESTIÓN DE EVENTOS</p>
        <h1>{{ eventId() ? 'Editar evento' : 'Crear evento' }}<span>.</span></h1>
        <p>Completa los datos del evento y guarda los cambios.</p>
      </div>

      @if (editor.loading()) {
        <p class="muted" role="status">Cargando formulario…</p>
      } @else if (editor.error() && !editor.venues().length) {
        <app-error-state [message]="editor.error()!" (retry)="load()" />
      } @else {
        @if (saved()) {
          <div class="editor-notice success" role="status">Evento guardado correctamente.</div>
        }
        @if (editor.error()) {
          <div class="editor-notice" role="alert">{{ editor.error() }}</div>
        }
        @if (validationError()) {
          <div class="editor-notice" role="alert">{{ validationError() }}</div>
        }
        @if (!editor.venues().length) {
          <div class="editor-notice" role="alert">
            Necesitas crear un local en Gestión → Locales antes de registrar un evento.
          </div>
        }
        @if (editor.event()?.deletedAt) {
          <div class="editor-notice" role="alert">
            Este evento está eliminado y no se puede editar.
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="save()" class="editor-form">
          <section class="editor-panel">
            <h2>Información</h2>
            <div class="editor-fields">
              <label
                >Título <span>*</span>
                <input formControlName="title" maxlength="180" autocomplete="off" />
                @if (form.controls.title.touched && form.controls.title.invalid) {
                  <small>Introduce un título.</small>
                }
              </label>
              <label
                >Tipo de evento <span>*</span>
                <select formControlName="eventType">
                  <option value="">Selecciona un tipo</option>
                  @for (type of eventTypes; track type) {
                    <option [value]="type">{{ label(type) }}</option>
                  }
                </select>
              </label>
              <h3 class="editor-wide editor-subheading">Ubicación</h3>
              <label
                >Local <span>*</span>
                <select formControlName="venueId">
                  <option value="">Selecciona un local</option>
                  @for (venue of editor.venues(); track venue.id) {
                    <option [value]="venue.id">{{ venue.name }} · {{ venue.municipality }}</option>
                  }
                </select>
              </label>
              @if (auth.user()?.role === 'ADMIN') { <label
                >Promotor
                <select formControlName="promoterId">
                  <option value="">Sin promotor</option>
                  @for (promoter of editor.promoters(); track promoter.id) {
                    <option [value]="promoter.id">{{ promoter.name }}</option>
                  }
                </select>
              </label> }
              <h3 class="editor-wide editor-subheading">Fecha y horario</h3>
              <label
                >Comienzo <span>*</span>
                <input type="datetime-local" formControlName="startsAt" />
              </label>
              <label
                >Final <span>*</span>
                <input type="datetime-local" formControlName="endsAt" />
              </label>
              @if (dateError()) {
                <p class="editor-field-error" role="alert">{{ dateError() }}</p>
              }
              <h3 class="editor-wide editor-subheading">Publicación</h3>
              <label
                >Estado <span>*</span>
                <select formControlName="status">
                  @for (status of statuses; track status) {
                    <option [value]="status">{{ label(status) }}</option>
                  }
                </select>
                <small class="editor-help">Los borradores no aparecen en la agenda pública.</small>
              </label>
              <label class="editor-toggle"><input type="checkbox" formControlName="isActive" [attr.disabled]="editor.event()?.deletedAt ? true : null" /> Evento activo</label>
              <h3 class="editor-wide editor-subheading">Clasificación y descripción</h3>
              <label
                >Edad mínima
                <input type="number" min="0" step="1" formControlName="minimumAge" />
              </label>
              <label class="editor-wide"
                >Descripción
                <textarea formControlName="description" maxlength="5000" rows="5"></textarea>
              </label>
              <label
                >Código de vestimenta
                <select formControlName="dressCode">
                  <option value="">Sin especificar</option>
                  @for (code of dressCodes; track code) {
                    <option [value]="code">{{ label(code) }}</option>
                  }
                </select>
              </label>
              <h3 class="editor-wide editor-subheading">Contenido visual</h3>
              <label
                >URL del cartel
                <input type="text" formControlName="posterUrl" placeholder="https://… o /posters/…" />
                @if (form.controls.posterUrl.touched && form.controls.posterUrl.invalid) {
                  <small>Introduce una URL HTTP/HTTPS o un cartel local de /posters/.</small>
                }
              </label>
            </div>
          </section>

          <section class="editor-panel">
            <h2>Música, ambiente y público</h2>
            <p>Marca las opciones que describen este evento.</p>
            <fieldset>
              <legend>Géneros musicales</legend>
              <div class="editor-options">
                @for (genre of genres; track genre) {
                  <label
                    ><input
                      type="checkbox"
                      [checked]="selected('musicGenres', genre)"
                      (change)="toggleSelection('musicGenres', genre, $event)"
                    />
                    {{ label(genre) }}</label
                  >
                }
              </div>
            </fieldset>
            <fieldset>
              <legend>Ambiente</legend>
              <div class="editor-options">
                @for (atmosphere of atmospheres; track atmosphere) {
                  <label
                    ><input
                      type="checkbox"
                      [checked]="selected('atmosphere', atmosphere)"
                      (change)="toggleSelection('atmosphere', atmosphere, $event)"
                    />
                    {{ label(atmosphere) }}</label
                  >
                }
              </div>
            </fieldset>
            <fieldset>
              <legend>Público ideal</legend>
              <div class="editor-options">
                @for (ideal of ideals; track ideal) {
                  <label
                    ><input
                      type="checkbox"
                      [checked]="selected('idealFor', ideal)"
                      (change)="toggleSelection('idealFor', ideal, $event)"
                    />
                    {{ label(ideal) }}</label
                  >
                }
              </div>
            </fieldset>
          </section>

          <div class="editor-actions">
            <button
              class="button-primary"
              type="submit"
              [disabled]="editor.saving() || !editor.venues().length || !!editor.event()?.deletedAt"
            >
              {{ editor.saving() ? 'Guardando…' : eventId() ? 'Guardar cambios' : 'Crear evento' }}
              <span>↗</span>
            </button>
            @if (canViewEvent()) {
              <a class="button-outline" [routerLink]="['/events', editor.event()!.slug]"
                >Ver evento ↗</a
              >
            }
          </div>
        </form>
      }
    </main>
  `,
})
export class EventFormComponent implements OnInit {
  readonly editor = inject(EventEditorStore);
  readonly eventTypes = eventTypes;
  readonly statuses = statuses;
  readonly genres = genres;
  readonly atmospheres = atmospheres;
  readonly ideals = ideals;
  readonly dressCodes = dressCodes;
  readonly label = readableTag;
  readonly saved = signal(false);
  readonly eventId = input<string | null>(null);
  readonly eventSaved = output<NocturnoEvent>();
  readonly validationError = signal<string | null>(null);
  readonly dateError = signal<string | null>(null);
  private readonly eventsStore = inject(EventsStore);
  readonly auth = inject(AuthStore);
  private readonly formBuilder = inject(FormBuilder);
  readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(180)]],
    eventType: ['', Validators.required],
    venueId: ['', Validators.required],
    promoterId: [''],
    startsAt: ['', Validators.required],
    endsAt: ['', Validators.required],
    status: ['DRAFT', Validators.required],
    isActive: [true],
    minimumAge: ['', Validators.pattern(/^\d*$/)],
    description: [''],
    dressCode: [''],
    posterUrl: ['', Validators.pattern(/^(https?:\/\/[^\s]+|\/posters\/[a-z0-9-]+\.svg)$/i)],
    musicGenres: [[] as string[]],
    atmosphere: [[] as string[]],
    idealFor: [[] as string[]],
  });

  ngOnInit() {
    void this.load();
  }

  async load() {
    await this.editor.load(this.eventId());
    const event = this.editor.event();
    if (event) this.fillForm(event);
  }

  selected(field: SelectionField, value: string): boolean {
    return this.form.controls[field].value.includes(value);
  }

  toggleSelection(field: SelectionField, value: string, change: Event) {
    const current = this.form.controls[field].value;
    const checked = (change.target as HTMLInputElement).checked;
    this.form.controls[field].setValue(
      checked ? [...current, value] : current.filter((item) => item !== value),
    );
    this.form.controls[field].markAsDirty();
  }

  canViewEvent(): boolean {
    const event = this.editor.event();
    return (
      !!event &&
      event.isActive &&
      !event.deletedAt &&
      ['PUBLISHED', 'SOLD_OUT'].includes(event.status)
    );
  }

  async save() {
    this.saved.set(false);
    this.validationError.set(null);
    this.dateError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.validationError.set('Revisa los campos obligatorios y los valores marcados.');
      return;
    }
    const values = this.form.getRawValue();
    const start = new Date(values.startsAt);
    const end = new Date(values.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      this.dateError.set('La fecha de finalización debe ser posterior al comienzo.');
      return;
    }
    const event = await this.editor.save(this.eventId(), {
      venueId: values.venueId,
      promoterId: this.auth.user()?.role === 'PROMOTER'
        ? this.auth.user()?.promoterId ?? null : values.promoterId || null,
      title: values.title.trim(),
      description: values.description.trim() || null,
      eventType: values.eventType,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      minimumAge:
        values.minimumAge == null || values.minimumAge === '' ? null : Number(values.minimumAge),
      dressCode: values.dressCode || null,
      musicGenres: values.musicGenres,
      atmosphere: values.atmosphere,
      idealFor: values.idealFor,
      posterUrl: values.posterUrl.trim() || null,
      status: values.status,
      isActive: values.isActive,
    });
    if (!event) return;
    this.saved.set(true);
    void this.eventsStore.refreshEvents();
    this.eventSaved.emit(event);
  }

  private fillForm(event: NocturnoEvent) {
    this.form.setValue({
      title: event.title,
      eventType: event.eventType,
      venueId: event.venueId,
      promoterId: event.promoterId ?? '',
      startsAt: localDateTime(event.startsAt),
      endsAt: localDateTime(event.endsAt),
      status: event.status,
      isActive: event.isActive,
      minimumAge: event.minimumAge === null ? '' : String(event.minimumAge),
      description: event.description ?? '',
      dressCode: event.dressCode ?? '',
      posterUrl: event.posterUrl ?? '',
      musicGenres: event.musicGenres,
      atmosphere: event.atmosphere,
      idealFor: event.idealFor,
    });
  }
}

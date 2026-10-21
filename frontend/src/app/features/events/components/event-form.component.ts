import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Event as NocturnoEvent, EventImageInput, Promoter, Venue } from '../../../core/models/domain.model';
import { ErrorStateComponent } from '../../../shared/components/states';
import { readableTag } from '../../../shared/utils/format';
import { EventGalleryEditorComponent } from './event-gallery-editor.component';
import { EventFormValues, prepareEventImages } from '../utils/event-form.mapper';

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
  imports: [ReactiveFormsModule, RouterLink, ErrorStateComponent, EventGalleryEditorComponent],
  templateUrl: './event-form.component.html',
})
export class EventFormComponent implements OnInit {
  readonly eventTypes = eventTypes;
  readonly statuses = statuses;
  readonly genres = genres;
  readonly atmospheres = atmospheres;
  readonly ideals = ideals;
  readonly dressCodes = dressCodes;
  readonly label = readableTag;
  readonly saved = input(false);
  readonly eventId = input<string | null>(null);
  readonly event = input<NocturnoEvent | null>(null);
  readonly venues = input<Venue[]>([]);
  readonly promoters = input<Promoter[]>([]);
  readonly maxImages = input(24);
  readonly error = input<string | null>(null);
  readonly saving = input(false);
  readonly isAdmin = input(false);
  readonly submitted = output<{ values: EventFormValues; images: EventImageInput[]; galleryOnly: boolean }>();
  readonly reloadRequested = output<void>();
  readonly validationError = signal<string | null>(null);
  readonly dateError = signal<string | null>(null);
  readonly initialGallery = signal<EventImageInput[]>([]);
  readonly galleryDraft = signal<EventImageInput[]>([]);
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
    musicGenres: [[] as string[]],
    atmosphere: [[] as string[]],
    idealFor: [[] as string[]],
  });

  ngOnInit() {
    const event = this.event();
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
    const event = this.event();
    return (
      !!event &&
      event.isActive &&
      !event.deletedAt &&
      ['PUBLISHED', 'SOLD_OUT'].includes(event.status)
    );
  }

  save() {
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
    const gallery = prepareEventImages(this.galleryDraft(), this.maxImages());
    if (gallery.error) {
      this.validationError.set(gallery.error);
      return;
    }
    this.submitted.emit({
      values,
      images: gallery.images,
      galleryOnly: !!this.eventId() && this.form.pristine,
    });
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
      musicGenres: event.musicGenres,
      atmosphere: event.atmosphere,
      idealFor: event.idealFor,
    });
    const images = event.images?.length
      ? event.images.map(({ url, altText, sourceUrl }) => ({ url, altText, sourceUrl }))
      : event.posterUrl ? [{ url: event.posterUrl, altText: event.title,
          sourceUrl: event.imageSourceUrl ?? null }] : [];
    this.initialGallery.set(images);
    this.galleryDraft.set(images);
  }
}

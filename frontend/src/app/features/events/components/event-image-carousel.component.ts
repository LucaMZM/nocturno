import { Component, computed, effect, input, signal } from '@angular/core';
import type { Event, EventImage } from '../../../core/models/domain.model';

@Component({
  selector: 'app-event-image-carousel',
  templateUrl: './event-image-carousel.component.html',
})
export class EventImageCarouselComponent {
  readonly event = input.required<Event>();
  readonly images = computed<EventImage[]>(() => {
    const event = this.event();
    if (event.images?.length) return event.images;
    return event.posterUrl ? [{ id: 'legacy-cover', url: event.posterUrl, position: 0,
      altText: event.title, sourceUrl: event.imageSourceUrl ?? null }] : [];
  });
  readonly selectedIndex = signal(0);
  readonly imageLoaded = signal(false);
  readonly brokenUrls = signal<Set<string>>(new Set());
  readonly currentImage = computed(() => this.images()[this.selectedIndex()] ?? null);

  constructor() {
    effect(() => {
      this.images();
      this.selectedIndex.set(0);
      this.imageLoaded.set(false);
      this.brokenUrls.set(new Set());
    });
  }

  select(index: number) {
    if (index < 0 || index >= this.images().length) return;
    this.selectedIndex.set(index);
    this.imageLoaded.set(false);
  }

  previous() { this.select((this.selectedIndex() - 1 + this.images().length) % this.images().length); }
  next() { this.select((this.selectedIndex() + 1) % this.images().length); }

  onKeydown(event: KeyboardEvent) {
    if (this.images().length < 2) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); this.previous(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); this.next(); }
  }

  onImageError(url: string) {
    this.brokenUrls.set(new Set([...this.brokenUrls(), url]));
    this.imageLoaded.set(true);
  }
}

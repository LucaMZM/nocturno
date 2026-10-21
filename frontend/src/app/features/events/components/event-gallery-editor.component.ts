import { Component, effect, input, output, signal } from '@angular/core';
import type { EventImageInput } from '../../../core/models/domain.model';
import { isHttpUrl, isSafeEventImageUrl } from '../utils/event-form.mapper';

interface ImageRow extends EventImageInput { key: number; url: string; altText: string; sourceUrl: string; }

@Component({
  selector: 'app-event-gallery-editor',
  templateUrl: './event-gallery-editor.component.html',
})
export class EventGalleryEditorComponent {
  readonly initialImages = input<EventImageInput[]>([]);
  readonly maxImages = input(24);
  readonly imagesChanged = output<EventImageInput[]>();
  readonly rows = signal<ImageRow[]>([]);
  readonly failedPreviews = signal<Set<number>>(new Set());
  readonly isSafeUrl = isSafeEventImageUrl;
  readonly isHttpUrl = isHttpUrl;
  private nextKey = 0;

  constructor() {
    effect(() => {
      const initial = this.initialImages();
      const count = Math.min(this.maxImages(), Math.max(3, initial.length));
      this.rows.set(Array.from({ length: count }, (_, index) => this.createRow(initial[index])));
      this.failedPreviews.set(new Set());
    });
  }

  private createRow(image?: EventImageInput): ImageRow {
    return {
      key: ++this.nextKey,
      url: image?.url ?? '',
      altText: image?.altText ?? '',
      sourceUrl: image?.sourceUrl ?? '',
    };
  }

  private publish(rows: ImageRow[]) {
    this.rows.set(rows);
    this.imagesChanged.emit(rows.map(({ url, altText, sourceUrl }) => ({ url, altText, sourceUrl })));
  }

  update(index: number, field: 'url' | 'altText' | 'sourceUrl', value: string) {
    const rows = [...this.rows()];
    const row = rows[index];
    rows[index] = { ...row, [field]: value,
      ...(field === 'url' && row.url !== value ? { sourceUrl: '' } : {}) };
    if (field === 'url') {
      const failed = new Set(this.failedPreviews());
      failed.delete(row.key);
      this.failedPreviews.set(failed);
    }
    this.publish(rows);
  }

  add() {
    if (this.rows().length < this.maxImages()) this.publish([...this.rows(), this.createRow()]);
  }

  remove(index: number) {
    this.publish(this.rows().filter((_, current) => current !== index));
  }

  move(index: number, direction: -1 | 1) {
    const target = index + direction;
    const rows = [...this.rows()];
    if (target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    this.publish(rows);
  }

  onPreviewError(key: number) {
    this.failedPreviews.set(new Set([...this.failedPreviews(), key]));
  }

  onPreviewLoaded(key: number) {
    const failed = new Set(this.failedPreviews());
    failed.delete(key);
    this.failedPreviews.set(failed);
  }
}

import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, input, output } from '@angular/core';
import { EventDeletionImpact, EventDeletionResult } from '../../services/events-api.service';

@Component({
  selector: 'app-event-deletion-dialog',
  templateUrl: './event-deletion-dialog.component.html',
  styleUrl: './event-deletion-dialog.component.css',
})
export class EventDeletionDialogComponent implements AfterViewInit, OnDestroy {
  readonly title = input.required<string>();
  readonly impact = input<EventDeletionImpact | null>(null);
  readonly loading = input(false);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly stale = input(false);
  readonly result = input<EventDeletionResult | null>(null);
  readonly dismiss = output<void>();
  readonly refresh = output<void>();
  readonly confirm = output<void>();
  readonly groups = [
    { action: 'delete', title: 'Se eliminarán', symbol: '−' },
    { action: 'deactivate', title: 'Se desactivarán o retirarán', symbol: '◌' },
    { action: 'preserve', title: 'Se conservarán', symbol: '✓' },
    { action: 'block', title: 'Impiden continuar', symbol: '!' },
  ] as const;
  readonly hasDependencies = (relation: EventDeletionImpact['relations'][number]) => relation.count > 0;
  private readonly document = inject(DOCUMENT);
  @ViewChild('dialog') private dialog!: ElementRef<HTMLDialogElement>;
  private previousFocus: HTMLElement | null = null;
  private previousOverflow = '';

  ngAfterViewInit() {
    this.previousFocus = this.document.activeElement as HTMLElement | null;
    this.previousOverflow = this.document.body.style.overflow;
    this.dialog.nativeElement.showModal();
    this.document.body.style.overflow = 'hidden';
    this.dialog.nativeElement.querySelector<HTMLElement>('[autofocus]')?.focus();
  }

  rows(action: EventDeletionImpact['relations'][number]['action']) {
    return this.impact()?.relations.filter((row) => row.action === action && row.count > 0) ?? [];
  }

  cancel(event?: Event) {
    event?.preventDefault();
    if (!this.saving()) this.dismiss.emit();
  }

  outsideClick(event: MouseEvent) {
    if (event.target !== this.dialog.nativeElement) return;
    const box = this.dialog.nativeElement.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) this.cancel();
  }

  trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const buttons = this.dialog.nativeElement.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    if (!buttons.length) { event.preventDefault(); this.dialog.nativeElement.focus(); return; }
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && this.document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && this.document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  ngOnDestroy() {
    this.dialog?.nativeElement.close();
    this.document.body.style.overflow = this.previousOverflow;
    this.previousFocus?.focus({ preventScroll: true });
  }
}

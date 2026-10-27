import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import {
  COOKIE_CHOICE_KEY,
  CookieChoice,
  cookieChoice,
  readCookieChoice,
} from '../utils/cookie-choice';

type OptionalCookie = 'preferences' | 'analytics' | 'marketing';

@Component({
  selector: 'app-cookie-preferences',
  templateUrl: './cookie-preferences.component.html',
  styleUrl: './cookie-preferences.component.css',
})
export class CookiePreferencesComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  @ViewChild('preferencesDialog') private dialog?: ElementRef<HTMLDialogElement>;
  private previousFocus: HTMLElement | null = null;
  private previousOverflow = '';
  readonly choice = signal<CookieChoice | null>(readCookieChoice(this.storage));
  readonly draft = signal(cookieChoice());
  readonly categories: { key: OptionalCookie; title: string; description: string }[] = [
    { key: 'preferences', title: 'Recordar mi elección',
      description: 'Guarda esta preferencia en este navegador para no volver a mostrar el aviso. Si la desactivas, solo se recuerda durante esta visita.' },
  ];

  private get storage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }

  chooseAll(optional: boolean) {
    this.save(cookieChoice(optional));
  }

  openPreferences() {
    if (!this.dialog || this.dialog.nativeElement.open) return;
    this.previousFocus = this.document.activeElement as HTMLElement;
    this.previousOverflow = this.document.body.style.overflow;
    this.draft.set({ ...(this.choice() ?? cookieChoice()) });
    this.dialog.nativeElement.showModal();
    this.dialog.nativeElement.querySelector<HTMLElement>('[autofocus]')?.focus();
    this.document.body.style.overflow = 'hidden';
  }

  toggle(key: OptionalCookie) {
    this.draft.update((choice) => ({ ...choice, [key]: !choice[key] }));
  }

  save(choice = this.draft()) {
    try {
      if (choice.preferences) this.storage?.setItem(COOKIE_CHOICE_KEY, JSON.stringify(choice));
      else this.storage?.removeItem(COOKIE_CHOICE_KEY);
    } catch {
      /* The choice still works for this visit. */
    }
    this.choice.set({ ...choice, analytics: false, marketing: false });
    this.dialog?.nativeElement.close();
  }

  close() {
    this.dialog?.nativeElement.close();
  }

  trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const buttons =
      this.dialog?.nativeElement.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    if (!buttons?.length) return;
    const first = buttons[0],
      last = buttons[buttons.length - 1];
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onClose() {
    this.document.body.style.overflow = this.previousOverflow;
    this.previousFocus?.focus({ preventScroll: true });
    this.previousFocus = null;
  }

  outsideClick(event: MouseEvent) {
    const dialog = this.dialog?.nativeElement;
    if (!dialog || event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      dialog.close();
  }

  ngOnDestroy() {
    if (this.dialog?.nativeElement.open) {
      this.close();
      this.onClose();
    }
  }
}

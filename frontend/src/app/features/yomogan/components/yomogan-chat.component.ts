import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  afterEveryRender,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { YomoganMessage } from '../services/yomogan-api.service';

@Component({
  selector: 'app-yomogan-chat',
  imports: [RouterLink],
  templateUrl: './yomogan-chat.component.html',
  styleUrl: './yomogan-chat.component.css',
})
export class YomoganChatComponent {
  private readonly document = inject(DOCUMENT);
  @ViewChild('composer') private composer?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('conversation') private conversation?: ElementRef<HTMLElement>;
  @ViewChild('launcher') private launcher?: ElementRef<HTMLButtonElement>;
  readonly open = input(false);
  readonly messages = input<YomoganMessage[]>([]);
  readonly pending = input(false);
  readonly error = input<string | null>(null);
  readonly avatarUrl = input<string | null>(null);
  readonly available = input(true);
  readonly openChanged = output<boolean>();
  readonly messageSent = output<string>();
  readonly retryRequested = output<void>();
  readonly conversationReset = output<void>();
  readonly draft = signal('');
  readonly avatarFailed = signal(false);
  readonly suggestions = [
    'Techno en Valencia por menos de 20 €',
    '¿Qué planes hay el sábado en Madrid?',
    'Reggaetón universitario en Barcelona',
    'Estoy indeciso, ¿por dónde empezamos?',
  ];
  private wasOpen = false;
  private lastCount = 0;
  private wasPending = false;
  private followBottom = true;

  constructor() {
    afterEveryRender(() => {
      const opened = this.open() && this.available();
      if (opened && !this.wasOpen) {
        this.composer?.nativeElement.focus();
        this.followBottom = true;
      }
      if (!opened && this.wasOpen) this.launcher?.nativeElement.focus({ preventScroll: true });
      this.wasOpen = opened;
      if (
        opened &&
        (this.lastCount !== this.messages().length || this.wasPending !== this.pending())
      ) {
        if (this.followBottom && this.conversation) {
          const element = this.conversation.nativeElement;
          element.scrollTop = element.scrollHeight;
        }
      }
      this.lastCount = this.messages().length;
      this.wasPending = this.pending();
    });
  }
  send(content = this.draft()) {
    const value = content.trim();
    if (this.pending() || this.error() || !value || value.length > 1200) return;
    this.followBottom = true;
    this.draft.set('');
    this.messageSent.emit(value);
  }
  keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.openChanged.emit(false);
    } else if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.send();
    }
  }
  trackScroll() {
    const element = this.conversation?.nativeElement;
    if (element)
      this.followBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 90;
  }
  reset() {
    this.draft.set('');
    this.followBottom = true;
    this.conversationReset.emit();
    this.composer?.nativeElement.focus();
  }
  price(value: number) {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(value);
  }
  when(value: string) {
    return new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }
  hideImage(event: Event) {
    (event.target as HTMLImageElement).hidden = true;
  }
}

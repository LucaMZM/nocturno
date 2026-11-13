import { Component, computed, input, signal } from '@angular/core';

@Component({
  selector: 'app-avatar',
  template: `@if (url() && failedUrl() !== url()) {
    <img [src]="url()!" [alt]="name()" (error)="failedUrl.set(url())" referrerpolicy="no-referrer" />
  } @else { <span role="img" [attr.aria-label]="'Avatar de ' + name()">{{ initials() }}</span> }`,
  styles: [`:host{display:inline-flex;flex-shrink:0;width:2.25rem;height:2.25rem;vertical-align:middle}
    img,span{width:100%;height:100%;border-radius:50%;object-fit:cover}
    span{display:grid;place-items:center;background:#171717;color:#F5F2EC;border:1px solid #AAA6A0;font-size:.75rem}`],
})
export class AvatarComponent {
  readonly url = input<string | null | undefined>(null);
  readonly name = input('Usuario');
  readonly failedUrl = signal<string | null | undefined>(undefined);
  readonly initials = computed(() => this.name().trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'N');
}

import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '../../../core/models/domain.model';

@Component({
  selector: 'app-profile-form', imports: [ReactiveFormsModule],
  template: `<form class="profile-form" [formGroup]="form" (ngSubmit)="save()">
    <label>Nombre visible <input formControlName="displayName" maxlength="120" required /></label>
    <label>Avatar (URL HTTPS) <input type="url" formControlName="avatarUrl" maxlength="2048" placeholder="https://…" /></label>
    <p class="muted">Deja la URL vacía para usar tus iniciales.</p>
    @if (form.invalid && form.touched) { <p role="alert">Revisa el nombre y la URL HTTPS del avatar.</p> }
    <button class="button-primary" type="submit" [disabled]="busy()">{{ busy() ? 'Un momento…' : 'Guardar perfil' }} <span>↗</span></button>
  </form>`,
})
export class ProfileFormComponent {
  readonly user = input<User | null>(null);
  readonly busy = input(false);
  readonly submitted = output<{ displayName: string; avatarUrl: string | null }>();
  readonly form = inject(FormBuilder).nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(120)]],
    avatarUrl: ['', [Validators.maxLength(2048), Validators.pattern(/^https:\/\/[^\s]+$/)]],
  });
  constructor() {
    effect(() => {
      const user = this.user();
      if (this.form.pristine) this.form.patchValue({ displayName: user?.displayName ?? '', avatarUrl: user?.avatarUrl ?? '' });
    });
  }
  save() {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.form.controls.displayName.value.trim()) return;
    this.submitted.emit({ displayName: this.form.controls.displayName.value.trim(), avatarUrl: this.form.controls.avatarUrl.value.trim() || null });
  }
}

import { Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-auth-form',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      @if (register()) { <label>Nombre
        <input autocomplete="name" formControlName="displayName" maxlength="120" />
      </label> }
      <label>Correo electrónico
        <input type="email" autocomplete="email" formControlName="email" required />
      </label>
      <label>Contraseña @if (register()) { <small>Al menos 10 caracteres.</small> }
        <input type="password" [attr.autocomplete]="register() ? 'new-password' : 'current-password'"
          formControlName="password" maxlength="128" required />
      </label>
      @if (invalid()) { <p class="inline-alert" role="alert">Revisa el correo, el nombre y la contraseña.</p> }
      @if (error()) { <p class="inline-alert" role="alert">{{ error() }}</p> }
      <button class="button-primary" type="submit" [disabled]="loading()">
        {{ loading() ? 'Un momento…' : register() ? 'Crear cuenta' : 'Entrar' }} <span>↗</span>
      </button>
    </form>
  `,
})
export class AuthFormComponent {
  readonly register = input(false);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly submitted = output<{ email: string; password: string; displayName: string }>();
  readonly form = inject(FormBuilder).nonNullable.group({
    displayName: ['', Validators.maxLength(120)],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });
  invalid() {
    return this.form.touched && (this.form.invalid || (this.register() &&
      (!this.form.controls.displayName.value.trim() || this.form.controls.password.value.length < 10)));
  }
  submit() {
    if (this.loading()) return;
    this.form.markAllAsTouched();
    if (this.invalid()) return;
    const values = this.form.getRawValue();
    this.submitted.emit({ ...values, displayName: values.displayName.trim() });
  }
}

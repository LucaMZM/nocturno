import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../store/auth.store';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="page-width auth-page">
      <div class="auth-panel">
        <p class="eyebrow">ÚNETE A NOCTURNO</p>
        <h1>Crear cuenta<span>.</span></h1>
        <p>Guarda tus planes y lleva todas tus entradas contigo.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>Nombre
            <input autocomplete="name" formControlName="displayName" maxlength="120" required />
          </label>
          <label>Correo electrónico
            <input type="email" autocomplete="email" formControlName="email" required />
          </label>
          <label>Contraseña <small>Al menos 10 caracteres.</small>
            <input type="password" autocomplete="new-password" formControlName="password" minlength="10" required />
          </label>
          @if (auth.error()) { <p class="inline-alert" role="alert">{{ auth.error() }}</p> }
          <button class="button-primary" type="submit" [disabled]="auth.loading()">
            {{ auth.loading() ? 'Creando cuenta…' : 'Crear cuenta' }} <span>↗</span>
          </button>
        </form>
        <p>¿Ya tienes cuenta? <a routerLink="/auth/login">Inicia sesión</a></p>
      </div>
    </main>
  `,
})
export class RegisterPage {
  readonly auth = inject(AuthStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly form = this.formBuilder.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(10)]],
  });

  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { email, password, displayName } = this.form.getRawValue();
    if (await this.auth.register(email, password, displayName))
      await this.router.navigateByUrl('/account');
  }
}

import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../store/auth.store';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="page-width auth-page">
      <div class="auth-panel">
        <p class="eyebrow">TU NOCHE EMPIEZA AQUÍ</p>
        <h1>Iniciar sesión<span>.</span></h1>
        <p>Accede a tus favoritos, entradas y pedidos.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>Correo electrónico
            <input type="email" autocomplete="email" formControlName="email" required />
          </label>
          <label>Contraseña
            <input type="password" autocomplete="current-password" formControlName="password" required />
          </label>
          @if (auth.error()) { <p class="inline-alert" role="alert">{{ auth.error() }}</p> }
          <button class="button-primary" type="submit" [disabled]="auth.loading()">
            {{ auth.loading() ? 'Entrando…' : 'Entrar' }} <span>↗</span>
          </button>
        </form>
        <p>¿Aún no tienes cuenta? <a routerLink="/auth/register">Regístrate</a></p>
      </div>
    </main>
  `,
})
export class LoginPage {
  readonly auth = inject(AuthStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { email, password } = this.form.getRawValue();
    if (!await this.auth.login(email, password)) return;
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    const destination = requested?.startsWith('/') && !requested.startsWith('//')
      ? requested : this.auth.user()?.role === 'USER' ? '/account' : '/dashboard';
    await this.router.navigateByUrl(destination);
  }
}

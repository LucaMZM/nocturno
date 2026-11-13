import { Component, inject } from '@angular/core';
import { AuthFormComponent } from '../components/auth-form.component';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../store/auth.store';

@Component({
  selector: 'app-register-page',
  imports: [AuthFormComponent, RouterLink],
  template: `
    <main class="page-width auth-page">
      <div class="auth-panel">
        <p class="eyebrow">ÚNETE A NOCTURNO</p>
        <h1>Crear cuenta<span>.</span></h1>
        <p>Guarda tus planes y lleva todas tus entradas contigo.</p>
        <app-auth-form [register]="true" [loading]="auth.loading()"
          [error]="auth.error()" (submitted)="submit($event)" />
        <p>¿Ya tienes cuenta? <a routerLink="/auth/login">Inicia sesión</a></p>
      </div>
    </main>
  `,
})
export class RegisterPage {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  async submit({ email, password, displayName }: { email: string; password: string; displayName: string }) {
    if (await this.auth.register(email, password, displayName))
      await this.router.navigateByUrl('/account');
  }
}

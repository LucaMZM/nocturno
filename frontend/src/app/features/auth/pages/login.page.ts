import { Component, inject } from '@angular/core';
import { AuthFormComponent } from '../components/auth-form.component';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../store/auth.store';

@Component({
  selector: 'app-login-page',
  imports: [AuthFormComponent, RouterLink],
  template: `
    <main class="page-width auth-page">
      <div class="auth-panel">
        <p class="eyebrow">TU NOCHE EMPIEZA AQUÍ</p>
        <h1>Iniciar sesión<span>.</span></h1>
        <p>Accede a tus favoritos, entradas y pedidos.</p>
        <app-auth-form [register]="false" [loading]="auth.loading()"
          [error]="auth.error()" (submitted)="submit($event)" />
        <p>¿Aún no tienes cuenta? <a routerLink="/auth/register">Regístrate</a></p>
      </div>
    </main>
  `,
})
export class LoginPage {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  async submit({ email, password, displayName }: { email: string; password: string; displayName: string }) {
    if (!await this.auth.login(email, password)) return;
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    const destination = requested?.startsWith('/') && !requested.startsWith('//')
      ? requested : this.auth.user()?.role === 'USER' ? '/account' : '/dashboard';
    await this.router.navigateByUrl(destination);
  }
}

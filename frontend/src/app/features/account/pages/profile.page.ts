import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore } from '../../auth/store/auth.store';

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="editor-panel">
      <p class="eyebrow">TU PERFIL</p><h2>Datos de la cuenta</h2>
      <p>Correo: {{ auth.user()?.email }}</p>
      <form class="profile-form" [formGroup]="form" (ngSubmit)="save()">
        <label>Nombre visible
          <input formControlName="displayName" maxlength="120" required />
        </label>
        @if (auth.error()) { <p class="inline-alert" role="alert">{{ auth.error() }}</p> }
        @if (saved()) { <p class="editor-notice success" role="status">Perfil guardado.</p> }
        <button class="button-primary" type="submit">Guardar perfil <span>↗</span></button>
      </form>
    </section>
  `,
})
export class ProfilePage implements OnInit {
  readonly auth = inject(AuthStore);
  readonly saved = signal(false);
  private readonly formBuilder = inject(FormBuilder);
  readonly form = this.formBuilder.nonNullable.group({ displayName: ['', [Validators.required, Validators.maxLength(120)]] });
  ngOnInit() { this.form.controls.displayName.setValue(this.auth.user()?.displayName ?? ''); }
  async save() {
    this.saved.set(false);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saved.set(await this.auth.updateProfile(this.form.controls.displayName.value.trim()));
  }
}

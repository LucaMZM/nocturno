import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfileStore } from '../store/profile.store';

@Component({
  selector: 'app-profile-page',
  providers: [ProfileStore],
  imports: [ReactiveFormsModule],
  template: `
    <section class="editor-panel">
      <p class="eyebrow">TU PERFIL</p><h2>Datos de la cuenta</h2>
      <p>Correo: {{ profile.user()?.email }}</p>
      @if (profile.loading()) { <p role="status">Cargando perfil…</p> }
      <form class="profile-form" [formGroup]="form" (ngSubmit)="save()">
        <label>Nombre visible
          <input formControlName="displayName" maxlength="120" required />
        </label>
        @if (profile.error()) { <p class="inline-alert" role="alert">{{ profile.error() }}</p> }
        @if (profile.saved()) { <p class="editor-notice success" role="status">Perfil guardado.</p> }
        <button class="button-primary" type="submit" [disabled]="profile.loading() || profile.saving()">{{ profile.saving() ? 'Guardando…' : 'Guardar perfil' }} <span>↗</span></button>
      </form>
    </section>
  `,
})
export class ProfilePage implements OnInit {
  readonly profile = inject(ProfileStore);
  private readonly formBuilder = inject(FormBuilder);
  readonly form = this.formBuilder.nonNullable.group({ displayName: ['', [Validators.required, Validators.maxLength(120)]] });
  async ngOnInit() {
    this.form.controls.displayName.setValue(this.profile.user()?.displayName ?? '');
    if (await this.profile.load() && this.form.pristine)
      this.form.controls.displayName.setValue(this.profile.user()?.displayName ?? '');
  }
  async save() {
    this.profile.clearFeedback();
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    if (await this.profile.save(this.form.controls.displayName.value.trim())) this.form.markAsPristine();
  }
}

import { Component, inject, OnInit } from '@angular/core';
import { ProfileFormComponent } from '../components/profile-form.component';
import { ProfileStore } from '../store/profile.store';

@Component({
  selector: 'app-profile-page', providers: [ProfileStore],
  imports: [ProfileFormComponent],
  template: `<section class="editor-panel">
    <p class="eyebrow">TU PERFIL</p><h2>Datos de la cuenta</h2>

    <p>Correo: {{ profile.user()?.email }}</p>
    @if (profile.loading()) { <p role="status">Cargando perfil…</p> }
    @if (profile.error()) { <p class="inline-alert" role="alert">{{ profile.error() }}</p> }
    @if (profile.saved()) { <p class="editor-notice success" role="status">Perfil guardado.</p> }
    <app-profile-form [user]="profile.user()" [busy]="profile.loading() || profile.saving()" (submitted)="save($event)" />
  </section>`,
})
export class ProfilePage implements OnInit {
  readonly profile = inject(ProfileStore);
  ngOnInit() { void this.profile.load(); }
  async save({ displayName }: { displayName: string }) {
    this.profile.clearFeedback();
    await this.profile.save(displayName);
  }
}

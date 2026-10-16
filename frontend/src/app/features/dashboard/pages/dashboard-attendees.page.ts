import { Component, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DashboardStore } from '../store/dashboard.store';
import { statusLabel, statusTone } from '../../../shared/utils/status-presentation';

interface ScanResult { rawValue: string }
interface CodeDetector { detect(video: HTMLVideoElement): Promise<ScanResult[]> }
type DetectorConstructor = new (options: { formats: string[] }) => CodeDetector;

@Component({
  selector: 'app-dashboard-attendees-page',
  imports: [RouterLink, FormsModule],
  template: `
    <a class="back-link" routerLink="/dashboard/events">← Eventos</a>
    <div class="dashboard-heading"><p class="eyebrow">OPERACIONES · CONTROL DE ACCESO</p><h2>Check-in<span>.</span></h2></div>
    @if (dashboard.checkInOverview(); as overview) {
      <div class="checkin-hero"><div><span class="eyebrow">{{ overview.venueName }} · {{ date(overview.startsAt) }}</span>
        <h3>{{ overview.eventTitle }}</h3><strong>{{ overview.used }} / {{ overview.issued }}</strong><span> personas registradas</span></div>
        <div class="checkin-stats"><span>{{ overview.pending }} pendientes</span><span>{{ overview.rejected }} anuladas</span><span>{{ overview.capacity }} plazas</span></div>
      </div>
    }
    @if (dashboard.error()) { <p class="inline-alert" role="alert">{{ dashboard.error() }} <button type="button" (click)="refresh()">Reintentar</button></p> }
    <section class="dashboard-section checkin-panel"><p class="eyebrow">VALIDAR ENTRADA</p><h3>Escanear o introducir código</h3>
      <form class="management-filters" (ngSubmit)="validateCode()">
        <label>Código de entrada <input name="code" [(ngModel)]="code" autocomplete="off" placeholder="UUID del ticket" required /></label>
        <button class="button-primary" [disabled]="dashboard.checkingIn() || !code().trim()">{{ dashboard.checkingIn() ? 'Validando…' : 'Validar entrada' }}</button>
      </form>
      <button class="button-outline" type="button" [disabled]="openingCamera()" (click)="scanning() ? stopScanner(true) : startScanner()">{{ openingCamera() ? 'Esperando cámara…' : scanning() ? 'Detener cámara' : 'Abrir escáner QR' }}</button>
      @if (scannerMessage()) { <p class="muted" role="status">{{ scannerMessage() }}</p> }
      <video #video class="scanner-video" [hidden]="!scanning()" autoplay playsinline muted aria-label="Cámara para leer códigos QR"></video>
      @if (dashboard.checkInMessage()) {
        <div class="checkin-result" [class.valid]="dashboard.checkInResult()" [class.invalid]="!dashboard.checkInResult()" role="status">
          <strong>{{ dashboard.checkInResult() ? '✓ ACCESO CONCEDIDO' : '✕ ACCESO NO CONCEDIDO' }}</strong>
          <p>{{ dashboard.checkInMessage() }}</p>
          @if (dashboard.checkInResult(); as result) { <small>{{ time(result.usedAt!) }} · {{ result.code }}</small> }
        </div>
      }
    </section>
    <section class="dashboard-section"><div class="row-between"><h3>Buscar asistente</h3><button type="button" class="button-text" (click)="refresh()">Actualizar ↻</button></div>
      <form class="management-filters" (ngSubmit)="searchAttendees()"><label>Buscar por código, nombre, correo o pedido
        <input name="search" [(ngModel)]="search" placeholder="Nombre, correo, código…" /></label>
        <button class="button-outline">Buscar</button></form>
      @if (dashboard.loading()) { <p role="status">Cargando asistentes…</p> }
      @if (!dashboard.loading() && !dashboard.error() && !dashboard.attendees().length) { <p class="muted">No hay asistentes con estos criterios.</p> }
      <div class="management-table-wrap"><table class="management-table"><thead><tr>
        <th>Comprador</th><th>Correo</th><th>Entrada</th><th>Código</th><th>Estado</th><th>Hora</th><th>Acción</th>
      </tr></thead><tbody>
        @for (person of dashboard.attendees(); track person.id) { <tr>
          <td>{{ person.displayName }}</td><td>{{ person.email }}</td><td>{{ person.ticketTypeName }}</td>
          <td><code>{{ person.code.slice(0, 8) }}…</code></td><td><span [class]="'state-badge state-' + tone(person.status)">{{ label(person.status) }}</span></td>
          <td>{{ person.usedAt ? time(person.usedAt) : '—' }}</td>
          <td>@if (person.status === 'VALID') { <button class="text-action" [disabled]="dashboard.checkingIn()" (click)="admit(person.code)">Validar</button> }</td>
        </tr> }
      </tbody></table></div>
      <div class="pagination-actions"><button class="button-outline" [disabled]="dashboard.pagination().page <= 1" (click)="page(-1)">Anterior</button>
        <span>Página {{ dashboard.pagination().page }} de {{ dashboard.pagination().totalPages || 1 }}</span>
        <button class="button-outline" [disabled]="dashboard.pagination().page >= dashboard.pagination().totalPages" (click)="page(1)">Siguiente</button></div>
    </section>
    @if (dashboard.checkInOverview()?.recent?.length) {
      <section class="dashboard-section"><h3>Accesos recientes</h3>
        @for (entry of dashboard.checkInOverview()!.recent; track entry.id) {
          <p class="dashboard-alert">{{ time(entry.usedAt) }} · {{ entry.displayName }} · {{ entry.ticketTypeName }}</p>
        }
      </section>
    }
  `,
})
export class DashboardAttendeesPage implements OnInit, OnDestroy {
  readonly dashboard = inject(DashboardStore);
  readonly label = statusLabel;
  readonly tone = statusTone;
  readonly eventId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly code = signal('');
  readonly search = signal('');
  readonly scanning = signal(false);
  readonly openingCamera = signal(false);
  readonly scannerMessage = signal<string | null>(null);
  @ViewChild('video') private video?: ElementRef<HTMLVideoElement>;
  private stream?: MediaStream;
  private timer?: ReturnType<typeof setInterval>;
  private detecting = false;
  private scannerRequestId = 0;
  ngOnInit() { this.refresh(); }
  ngOnDestroy() { this.stopScanner(); }
  refresh() {
    void this.dashboard.loadCheckInOverview(this.eventId);
    void this.dashboard.loadAttendees(this.eventId, this.dashboard.pagination().page, this.search());
  }
  searchAttendees() { void this.dashboard.loadAttendees(this.eventId, 1, this.search().trim()); }
  page(delta: number) { void this.dashboard.loadAttendees(this.eventId, this.dashboard.pagination().page + delta, this.search().trim()); }
  async validateCode() { await this.admit(this.code().trim()); }
  async admit(code: string) {
    if (!code) return;
    const accepted = await this.dashboard.checkIn(code, this.eventId);
    if (accepted) { this.code.set(''); this.stopScanner(); void this.dashboard.loadAttendees(this.eventId, 1, this.search().trim()); }
  }
  async startScanner() {
    this.scannerMessage.set(null);
    const Detector = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      this.scannerMessage.set('Este navegador no permite leer QR desde la cámara. Usa el código o el buscador manual.'); return;
    }
    this.scannerMessage.set('Esperando permiso de cámara…');
    this.openingCamera.set(true);
    const requestId = ++this.scannerRequestId;
    let permissionTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      void request.then((stream) => {
        if (requestId !== this.scannerRequestId) stream.getTracks().forEach((track) => track.stop());
      }).catch(() => undefined);
      this.stream = await Promise.race([
        request,
        new Promise<MediaStream>((_, reject) => {
          permissionTimeout = setTimeout(() => reject(new Error('Camera permission timeout')), 10000);
        }),
      ]);
      if (permissionTimeout) clearTimeout(permissionTimeout);
      if (requestId !== this.scannerRequestId) return;
      this.openingCamera.set(false);
      this.scanning.set(true);
      setTimeout(async () => {
        const video = this.video?.nativeElement;
        if (!video || !this.stream) return;
        try {
          video.srcObject = this.stream;
          await video.play();
          this.scannerMessage.set('Cámara activa. Acerca el QR al encuadre.');
          const detector = new Detector({ formats: ['qr_code'] });
          this.timer = setInterval(async () => {
            if (this.detecting || !this.scanning()) return;
            this.detecting = true;
            try { const values = await detector.detect(video);
              if (values[0]?.rawValue) { this.code.set(values[0].rawValue); this.stopScanner(true); await this.validateCode(); }
            } catch { this.scannerMessage.set('No se puede leer la cámara. Introduce el código manualmente.'); this.stopScanner(); }
            finally { this.detecting = false; }
          }, 500);
        } catch { this.scannerMessage.set('No se puede iniciar la cámara. Introduce el código manualmente.'); this.stopScanner(); }
      }, 0);
    } catch {
      if (permissionTimeout) clearTimeout(permissionTimeout);
      this.scannerMessage.set('No hay acceso a la cámara o el permiso tardó demasiado. Introduce el código manualmente.');
      this.stopScanner();
    }
  }
  stopScanner(clearMessage = false) {
    this.scannerRequestId += 1;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    if (this.video) this.video.nativeElement.srcObject = null;
    if (clearMessage) this.scannerMessage.set(null);
    this.openingCamera.set(false);
    this.scanning.set(false);
  }
  date(value: string) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value)); }
  time(value: string) { return new Intl.DateTimeFormat('es-ES', { timeStyle: 'short' }).format(new Date(value)); }
}

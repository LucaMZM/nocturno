import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, input, OnDestroy, PLATFORM_ID, ViewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import type { Event } from '../../../core/models/domain.model';
import { euro, formatDistance } from '../../../shared/utils/format';

@Component({
  selector: 'app-event-map',
  template: `<div #mapHost class="event-map" role="application" aria-label="Mapa de eventos"></div>
    <p class="map-attribution-note">Mapa © OpenStreetMap contributors. {{ place() ? 'Ubicación del local.' : 'Los marcadores muestran eventos de la búsqueda actual.' }}</p>`,
})
export class EventMapComponent implements AfterViewInit, OnDestroy {
  readonly events = input.required<Event[]>();
  readonly center = input<{ latitude: number; longitude: number } | null>(null);
  readonly place = input<{ name: string; latitude: number; longitude: number } | null>(null);
  @ViewChild('mapHost') private host?: ElementRef<HTMLDivElement>;
  private map?: Leaflet.Map;
  private markers?: Leaflet.LayerGroup;
  private leaflet?: typeof Leaflet;
  private renderVersion = 0;
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  ngAfterViewInit() { void this.setup(); }

  private async setup() {
    if (!this.browser || !this.host || this.map) return;
    const leaflet = await import('leaflet');
    if (!this.host) return;
    this.leaflet = leaflet;
    this.map = leaflet.map(this.host.nativeElement, { scrollWheelZoom: false });
    leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(this.map);
    this.markers = leaflet.layerGroup().addTo(this.map);
    this.render();
  }

  // The parent passes only the server response for its current filters.
  ngOnChanges() { this.render(); }

  private render() {
    if (!this.map || !this.leaflet || !this.markers) return;
    const version = ++this.renderVersion;
    this.markers.clearLayers();
    const points: Leaflet.LatLngExpression[] = [];
    for (const event of this.events()) {
      if (event.venueLatitude == null || event.venueLongitude == null) continue;
      const latitude = Number(event.venueLatitude);
      const longitude = Number(event.venueLongitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const point: Leaflet.LatLngExpression = [latitude, longitude];
      points.push(point);
      const content = document.createElement('div');
      content.className = 'map-event-preview';
      const title = document.createElement('strong');
      title.textContent = event.title;
      const details = document.createElement('span');
      const time = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.startsAt));
      details.textContent = `${event.venueName || event.municipality || ''} · ${time}`;
      const price = document.createElement('span');
      price.textContent = `${event.minPrice == null ? 'Precio por confirmar' : `Desde ${euro(event.minPrice)}`}${event.distanceKm == null ? '' : ` · A ${formatDistance(event.distanceKm)}`}`;
      const link = document.createElement('a');
      link.href = `/events/${encodeURIComponent(event.slug)}`;
      link.textContent = 'Ver evento ↗';
      content.append(title, details, price, link);
      this.leaflet.marker(point, { title: event.title, alt: event.title, icon: this.leaflet.divIcon({ className: 'nocturno-map-pin', html: '<span></span>', iconSize: [26, 32], iconAnchor: [13, 31] }) })
        .bindPopup(content).addTo(this.markers);
    }
    const center = this.center();
    const place = this.place();
    if (place) {
      const point: Leaflet.LatLngExpression = [place.latitude, place.longitude];
      points.push(point);
      const label = document.createElement('strong');
      label.textContent = place.name;
      this.leaflet.marker(point, { title: place.name, alt: place.name, icon: this.leaflet.divIcon({ className: 'nocturno-map-pin', html: '<span></span>', iconSize: [26, 32], iconAnchor: [13, 31] }) })
        .bindPopup(label).addTo(this.markers);
    }
    if (center) points.push([center.latitude, center.longitude]);
    if (points.length > 1) this.map.fitBounds(this.leaflet.latLngBounds(points), { padding: [32, 32], maxZoom: 13 });
    else if (points.length === 1) this.map.setView(points[0], 13);
    else this.map.setView([39.47, -0.37], 5);
    requestAnimationFrame(() => { if (version === this.renderVersion) this.map?.invalidateSize(); });
  }

  ngOnDestroy() { this.map?.remove(); }
}

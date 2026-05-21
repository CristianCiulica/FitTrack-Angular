import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import * as L from 'leaflet';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../core/services/auth.service';
import { WeatherService, WeatherSummary } from '../../core/services/weather.service';

const LEAFLET_ICON_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const LEAFLET_ICON_RETINA_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const LEAFLET_SHADOW_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

@Component({
  selector: 'app-running',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    NzLayoutModule,
    NzMenuModule,
    NzButtonModule,
    NzIconModule,
    NzAvatarModule,
    NzCardModule,
  ],
  templateUrl: './running.component.html',
  styleUrls: ['./running.component.scss'],
})
export class RunningComponent implements AfterViewInit, OnDestroy, OnInit {
  isCollapsed = false;
  isTracking = false;
  mode: 'running' | 'walking' = 'running';
  statusText = 'Tap Start to begin tracking.';
  cityName = 'Brasov';

  weatherLoading = true;
  weatherError = '';
  weather?: WeatherSummary;

  distanceMeters = 0;
  steps = 0;
  avgSpeedKmh = 0;
  calories = 0;

  private map?: L.Map;
  private polyline?: L.Polyline;
  private marker?: L.CircleMarker;
  private watchId: number | null = null;
  private startTime: number | null = null;
  private lastLatLng: L.LatLng | null = null;

  constructor(
    public authService: AuthService,
    private message: NzMessageService,
    private weatherService: WeatherService,
  ) {}

  ngOnInit(): void {
    this.loadWeather();
  }

  ngAfterViewInit(): void {
    this.configureLeafletIcons();
    this.initMap();
  }

  ngOnDestroy(): void {
    this.stopTracking();
    this.map?.remove();
  }

  logout() {
    this.authService.logout().subscribe();
  }

  setMode(mode: 'running' | 'walking') {
    if (this.isTracking) return;
    this.mode = mode;
  }

  startTracking() {
    if (!navigator.geolocation) {
      this.message.error('Geolocation is not supported on this device.');
      return;
    }

    this.resetTracking(false);
    this.isTracking = true;
    this.statusText = 'Waiting for GPS signal...';
    this.startTime = Date.now();

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      (err) => this.handleError(err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
  }

  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.isTracking) {
      this.isTracking = false;
      this.statusText = 'Tracking stopped.';
    }
  }

  resetTracking(clearStatus = true) {
    this.distanceMeters = 0;
    this.steps = 0;
    this.avgSpeedKmh = 0;
    this.calories = 0;
    this.startTime = null;
    this.lastLatLng = null;
    this.polyline?.setLatLngs([]);
    if (clearStatus) {
      this.statusText = 'Tap Start to begin tracking.';
    }
  }

  get distanceKm(): string {
    return (this.distanceMeters / 1000).toFixed(2);
  }

  get avgSpeedDisplay(): string {
    return this.avgSpeedKmh.toFixed(1);
  }

  get caloriesDisplay(): string {
    return this.calories.toFixed(0);
  }

  private initMap() {
    const container = document.getElementById('running-map');
    if (!container) return;

    this.map = L.map(container, { zoomControl: true }).setView([0, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(this.map);

    this.polyline = L.polyline([], { color: '#1e6bff', weight: 4 }).addTo(this.map);
  }

  private handlePosition(pos: GeolocationPosition) {
    const { latitude, longitude, accuracy } = pos.coords;
    const point = L.latLng(latitude, longitude);

    if (!this.lastLatLng) {
      this.map?.setView([latitude, longitude], 16);
      this.marker = L.circleMarker([latitude, longitude], {
        radius: 6,
        color: '#ff3b30',
        fillColor: '#ff3b30',
        fillOpacity: 1,
      }).addTo(this.map!);
      this.statusText = `GPS locked. Accuracy ~${Math.round(accuracy)}m.`;
    } else {
      this.distanceMeters += this.haversineMeters(this.lastLatLng, point);
      this.updateMetrics();
      this.marker?.setLatLng(point);
    }

    this.lastLatLng = point;
    this.polyline?.addLatLng(point);
  }

  private handleError(err: GeolocationPositionError) {
    this.isTracking = false;
    this.statusText = 'Location permission denied.';
    if (err.code === err.PERMISSION_DENIED) {
      this.message.error('Location permission denied. Please enable it and try again.');
      return;
    }
    this.message.error('Unable to get location. Please try again.');
  }

  private updateMetrics() {
    if (!this.startTime) return;
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    if (elapsedSeconds <= 0) return;

    const distanceKm = this.distanceMeters / 1000;
    this.avgSpeedKmh = distanceKm / (elapsedSeconds / 3600);

    const strideMeters = this.mode === 'running' ? 1.2 : 0.78;
    this.steps = Math.floor(this.distanceMeters / strideMeters);

    const kcalPerKm = this.mode === 'running' ? 60 : 35;
    this.calories = distanceKm * kcalPerKm;
  }

  private haversineMeters(a: L.LatLng, b: L.LatLng) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadius = 6371000;

    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);

    const c = 2 * Math.atan2(
      Math.sqrt(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon),
      Math.sqrt(1 - sinDLat * sinDLat - Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon),
    );

    return earthRadius * c;
  }

  private configureLeafletIcons() {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: LEAFLET_ICON_RETINA_URL,
      iconUrl: LEAFLET_ICON_URL,
      shadowUrl: LEAFLET_SHADOW_URL,
    });
  }

  private loadWeather() {
    this.weatherLoading = true;
    this.weatherError = '';
    this.weatherService.getCityWeather(this.cityName).subscribe({
      next: (summary) => {
        this.weather = summary;
        this.weatherLoading = false;
      },
      error: () => {
        this.weatherError = 'Unable to load weather right now.';
        this.weatherLoading = false;
      },
    });
  }

  get scoreTone(): 'great' | 'ok' | 'poor' {
    if (!this.weather) return 'ok';
    if (this.weather.score >= 80) return 'great';
    if (this.weather.score < 50) return 'poor';
    return 'ok';
  }

  get shouldShowIndoorCta(): boolean {
    return !!this.weather?.willRain;
  }
}

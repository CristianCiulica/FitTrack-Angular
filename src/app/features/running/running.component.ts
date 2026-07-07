import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import * as L from 'leaflet';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../core/services/auth.service';
import { RunningSessionService } from '../../core/services/running-session.service';
import { WeatherService, WeatherSummary } from '../../core/services/weather.service';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';

const LEAFLET_ICON_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const LEAFLET_ICON_RETINA_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const LEAFLET_SHADOW_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
const GPS_CALIBRATION_MS = 5000;
const GPS_CALIBRATION_TIMEOUT_MS = 8000;
const GPS_REQUIRED_FIXES = 3;
const GPS_MAX_ACCURACY_METERS = 50;
const GPS_CALIBRATION_MAX_ACCURACY_METERS = 35;
const GPS_MARKER_MAX_ACCURACY_METERS = 120;
const WEATHER_FALLBACK_CITY = 'Bucharest';

interface AcceptedPosition {
  point: L.LatLng;
  timestamp: number;
  accuracy: number;
}

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
    NzCardModule,
    NzCardModule,
    AppMenuComponent,
    NzModalModule,
  ],
  templateUrl: './running.component.html',
  styleUrls: ['./running.component.scss'],
})
export class RunningComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('runningMap') mapContainer?: ElementRef<HTMLElement>;

  isTracking = false;
  isCalibrating = false;
  mode: 'running' | 'walking' = 'running';
  statusText = 'Tap Start to begin tracking.';
  calibrationSecondsRemaining = GPS_CALIBRATION_MS / 1000;
  gpsAccuracy?: number;
  weatherExpanded = false;
  activityExpanded = false;

  weatherLoading = true;
  weatherError = '';
  weather?: WeatherSummary;

  distanceMeters = 0;
  steps = 0;
  avgSpeedKmh = 0;
  calories = 0;
  elapsedSeconds = 0;

  private map?: L.Map;
  private polyline?: L.Polyline;
  private polylineCasing?: L.Polyline;
  private routePoints: [number, number][] = [];
  private marker?: L.CircleMarker;
  private elapsedTimer: ReturnType<typeof setInterval> | null = null;
  private watchId: number | null = null;
  private startTime: number | null = null;
  private sessionStartedAt: number | null = null;
  private lastAcceptedPosition: AcceptedPosition | null = null;
  private lastDisplayedPosition: AcceptedPosition | null = null;
  private calibrationStartedAt: number | null = null;
  private calibrationFixes = 0;
  private bestCalibrationPosition: AcceptedPosition | null = null;
  private calibrationTimer: ReturnType<typeof setInterval> | null = null;
  private movementConfirmed = false;

  private resizeHandler = () => this.map?.invalidateSize();

  constructor(
    public authService: AuthService,
    private message: NzMessageService,
    private runningSessionService: RunningSessionService,
    private weatherService: WeatherService,
    private modal: NzModalService,
  ) {}

  ngOnInit(): void {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    this.loadWeather();
  }

  ngAfterViewInit(): void {
    this.configureLeafletIcons();
    this.initMap();
    window.addEventListener('resize', this.resizeHandler);
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.stopTracking(false);
    this.stopElapsedTimer();
    window.removeEventListener('resize', this.resizeHandler);
    this.map?.remove();
  }

  logout() {
    if (this.isTracking) {
      this.message.warning('Stop the active workout before logging out.');
      return;
    }
    this.authService.logout().subscribe();
  }

  setMode(mode: 'running' | 'walking') {
    if (this.isTracking) return;
    this.mode = mode;
  }

  onModeChange(event: Event) {
    const mode = (event.target as HTMLSelectElement).value;
    if (mode === 'running' || mode === 'walking') {
      this.setMode(mode);
    }
  }

  quickStartRun() {
    if (this.isTracking) return;
    this.mode = 'running';
    this.startTracking();
  }

  // GPS tracking logic
  startTracking() {
    if (!navigator.geolocation) {
      this.message.error('Geolocation is not supported on this device.');
      return;
    }

    this.resetTracking(false);
    this.isTracking = true;
    this.isCalibrating = true;
    // fullscreen overlay just became visible; map needs to be resized
    setTimeout(() => this.map?.invalidateSize(), 80);
    this.runningSessionService.setTrackingActive(true);
    this.calibrationSecondsRemaining = GPS_CALIBRATION_MS / 1000;
    this.statusText = 'Allow location access to start tracking.';

    const locationOptions: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!this.isTracking) return;

        this.sessionStartedAt = Date.now();
        this.calibrationStartedAt = Date.now();
        this.statusText = 'Calibrating GPS. Keep the phone still.';
        this.startCalibrationTimer();
        this.handlePosition(position);

        this.watchId = navigator.geolocation.watchPosition(
          (pos) => this.handlePosition(pos),
          (err) => this.handleError(err),
          locationOptions,
        );
      },
      (err) => this.handleError(err),
      locationOptions,
    );
  }

  confirmStopTracking() {
    this.modal.confirm({
      nzTitle: 'End workout?',
      nzWidth: 300,
      nzOkText: 'End',
      nzOkDanger: true,
      nzOnOk: () => this.stopTracking(true),
      nzCancelText: 'Cancel',
      nzCentered: true,
      nzClassName: 'glass-modal'
    });
  }

  stopTracking(saveSession = true) {
    const wasTracking = this.isTracking;
    this.stopCalibrationTimer();
    this.stopElapsedTimer();
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (wasTracking) {
      this.isTracking = false;
      this.isCalibrating = false;
      this.statusText = 'Tracking stopped.';
      this.runningSessionService.setTrackingActive(false);
      if (saveSession) {
        this.saveCompletedSession();
      }
    }
  }

  resetTracking(clearStatus = true) {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.isTracking = false;
    this.distanceMeters = 0;
    this.steps = 0;
    this.avgSpeedKmh = 0;
    this.calories = 0;
    this.elapsedSeconds = 0;
    this.stopElapsedTimer();
    this.startTime = null;
    this.sessionStartedAt = null;
    this.lastAcceptedPosition = null;
    this.lastDisplayedPosition = null;
    this.calibrationStartedAt = null;
    this.calibrationFixes = 0;
    this.bestCalibrationPosition = null;
    this.movementConfirmed = false;
    this.calibrationSecondsRemaining = GPS_CALIBRATION_MS / 1000;
    this.gpsAccuracy = undefined;
    this.isCalibrating = false;
    this.runningSessionService.setTrackingActive(false);
    this.stopCalibrationTimer();
    this.polyline?.setLatLngs([]);
    this.polylineCasing?.setLatLngs([]);
    this.routePoints = [];
    this.marker?.remove();
    this.marker = undefined;
    if (clearStatus) {
      this.statusText = 'Tap Start to begin tracking.';
    }
  }

  get distanceKm(): string {
    return (this.distanceMeters / 1000).toFixed(2);
  }

  get elapsedDisplay(): string {
    const total = this.elapsedSeconds;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private startElapsedTimer() {
    this.stopElapsedTimer();
    this.elapsedTimer = setInterval(() => {
      if (this.startTime) {
        this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      }
    }, 1000);
  }

  private stopElapsedTimer() {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }

  get avgSpeedDisplay(): string {
    return this.avgSpeedKmh.toFixed(1);
  }

  get caloriesDisplay(): string {
    return this.calories.toFixed(0);
  }

  private initMap() {
    const container = this.mapContainer?.nativeElement;
    if (!container) return;

    this.map = L.map(container, { zoomControl: false, attributionControl: false }).setView([44.4268, 26.1025], 16);
    // voyager: streets, POIs and richer colors than the light variant
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
    }).addTo(this.map);

    // route with white casing, Strava style
    this.polylineCasing = L.polyline([], { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(this.map);
    this.polyline = L.polyline([], { color: '#0a84ff', weight: 5 }).addTo(this.map);
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private handlePosition(pos: GeolocationPosition) {
    const { latitude, longitude, accuracy } = pos.coords;
    const point = L.latLng(latitude, longitude);
    const timestamp = pos.timestamp || Date.now();
    this.gpsAccuracy = accuracy;

    if (this.isCalibrating) {
      this.handleCalibrationFix(point, timestamp, accuracy);
      return;
    }

    this.updateLivePosition(point, timestamp, accuracy);

    if (accuracy > GPS_MAX_ACCURACY_METERS) {
      this.statusText = `Weak GPS signal (~${Math.round(accuracy)}m). Waiting for a better fix.`;
      return;
    }

    const previous = this.lastAcceptedPosition;
    if (!previous) {
      this.acceptPosition(point, timestamp, accuracy, false);
      return;
    }

    const elapsedSeconds = (timestamp - previous.timestamp) / 1000;
    if (elapsedSeconds < 1) return;

    const segmentMeters = this.haversineMeters(previous.point, point);
    const noiseThreshold = Math.max(
      this.mode === 'running' ? 3 : 2,
      Math.min(8, (accuracy + previous.accuracy) * 0.2),
    );

    if (segmentMeters < noiseThreshold) {
      this.statusText = `GPS stable. Accuracy ~${Math.round(accuracy)}m.`;
      return;
    }

    const segmentSpeedKmh = (segmentMeters / elapsedSeconds) * 3.6;
    const maxPlausibleSpeedKmh = this.mode === 'running' ? 25 : 12;
    const reportedSpeedKmh =
      pos.coords.speed !== null && Number.isFinite(pos.coords.speed)
        ? pos.coords.speed * 3.6
        : null;

    const reportedSpeedLooksWrong =
      reportedSpeedKmh !== null &&
      reportedSpeedKmh > maxPlausibleSpeedKmh * 1.5 &&
      segmentSpeedKmh > maxPlausibleSpeedKmh * 0.75;

    if (segmentSpeedKmh > maxPlausibleSpeedKmh || reportedSpeedLooksWrong) {
      this.statusText = 'GPS jump ignored. Rechecking your position...';
      return;
    }

    this.movementConfirmed = true;

    this.distanceMeters += segmentMeters;
    this.acceptPosition(point, timestamp, accuracy, true);
    this.updateMetrics();
    this.statusText = `${this.mode === 'running' ? 'Run' : 'Walk'} tracking active. Accuracy ~${Math.round(accuracy)}m.`;
  }

  private handleError(err: GeolocationPositionError) {
    this.stopCalibrationTimer();
    this.stopElapsedTimer();
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.isCalibrating = false;
    this.runningSessionService.setTrackingActive(false);

    if (err.code === err.PERMISSION_DENIED) {
      this.statusText = 'Location permission denied.';
      this.message.error('Location permission denied. Please enable it and try again.');
      return;
    }

    if (err.code === err.TIMEOUT) {
      this.statusText = 'GPS signal timed out.';
      this.message.error('GPS signal timed out. Move outdoors and try again.');
      return;
    }

    this.statusText = 'GPS position unavailable.';
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

  private saveCompletedSession() {
    const userId = this.authService.currentUserId;
    if (!userId || !this.sessionStartedAt) {
      this.sessionStartedAt = null;
      return;
    }

    const endedAt = Date.now();
    const startedAt = this.sessionStartedAt;
    this.runningSessionService
      .saveSession({
        userId,
        mode: this.mode,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        durationSeconds: Math.max(1, Math.round((endedAt - startedAt) / 1000)),
        distanceMeters: Math.round(this.distanceMeters),
        steps: this.steps,
        averageSpeedKmh: Number(this.avgSpeedKmh.toFixed(1)),
        calories: Math.round(this.calories),
        route: this.routePoints,
      })
      .subscribe({
        next: () => this.message.success('Workout saved in History.'),
        error: () => this.message.error('Could not save your session. Please try again.'),
      });
    this.sessionStartedAt = null;
  }

  private handleCalibrationFix(point: L.LatLng, timestamp: number, accuracy: number) {
    if (!this.bestCalibrationPosition || accuracy < this.bestCalibrationPosition.accuracy) {
      this.bestCalibrationPosition = { point, timestamp, accuracy };
      this.updateMarker(point, false);
    }

    if (accuracy > GPS_CALIBRATION_MAX_ACCURACY_METERS) {
      this.statusText = `Calibrating GPS. Accuracy is ~${Math.round(accuracy)}m.`;
      return;
    }

    this.calibrationFixes += 1;
    const elapsedMs = this.calibrationStartedAt ? Date.now() - this.calibrationStartedAt : 0;
    const hasEnoughTime = elapsedMs >= GPS_CALIBRATION_MS;
    const hasEnoughFixes = this.calibrationFixes >= GPS_REQUIRED_FIXES;

    if (!hasEnoughTime || !hasEnoughFixes) {
      this.updateCalibrationStatus();
      return;
    }

    this.completeCalibration({ point, timestamp, accuracy });
  }

  private completeCalibration(position: AcceptedPosition) {
    this.isCalibrating = false;
    this.stopCalibrationTimer();
    this.startTime = Date.now();
    this.elapsedSeconds = 0;
    this.startElapsedTimer();
    this.lastAcceptedPosition = position;
    this.lastDisplayedPosition = position;
    this.movementConfirmed = false;
    this.updateMarker(position.point, true);
    this.polyline?.setLatLngs([position.point]);
    this.polylineCasing?.setLatLngs([position.point]);
    this.routePoints = [[position.point.lat, position.point.lng]];
    this.statusText =
      position.accuracy <= GPS_CALIBRATION_MAX_ACCURACY_METERS
        ? `GPS ready. Accuracy ~${Math.round(position.accuracy)}m.`
        : `Tracking started with a weak signal (~${Math.round(position.accuracy)}m).`;
  }

  private acceptPosition(
    point: L.LatLng,
    timestamp: number,
    accuracy: number,
    extendPath: boolean,
  ) {
    this.lastAcceptedPosition = { point, timestamp, accuracy };
    this.lastDisplayedPosition = { point, timestamp, accuracy };
    this.updateMarker(point, true);
    if (extendPath) {
      this.polyline?.addLatLng(point);
      this.polylineCasing?.addLatLng(point);
      this.routePoints.push([point.lat, point.lng]);
    } else {
      this.polyline?.setLatLngs([point]);
      this.polylineCasing?.setLatLngs([point]);
      this.routePoints = [[point.lat, point.lng]];
    }
  }

  private updateLivePosition(point: L.LatLng, timestamp: number, accuracy: number) {
    if (accuracy > GPS_MARKER_MAX_ACCURACY_METERS) return;

    const previous = this.lastDisplayedPosition;
    if (previous) {
      const elapsedSeconds = Math.max((timestamp - previous.timestamp) / 1000, 0.5);
      const distanceMeters = this.haversineMeters(previous.point, point);
      const displaySpeedKmh = (distanceMeters / elapsedSeconds) * 3.6;
      const maxDisplaySpeedKmh = this.mode === 'running' ? 45 : 25;
      const significantJump = distanceMeters > Math.max(25, accuracy + previous.accuracy);

      if (significantJump && displaySpeedKmh > maxDisplaySpeedKmh) {
        return;
      }
    }

    this.lastDisplayedPosition = { point, timestamp, accuracy };
    this.updateMarker(point, true);
  }

  private updateMarker(point: L.LatLng, followPosition: boolean) {
    if (!this.marker && this.map) {
      this.marker = L.circleMarker(point, {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#0a84ff',
        fillOpacity: 1,
      }).addTo(this.map);
      this.map.setView(point, 16);
      return;
    }

    this.marker?.setLatLng(point);
    if (followPosition && this.map && !this.map.getBounds().pad(-0.2).contains(point)) {
      this.map.panTo(point, { animate: true });
    }
  }

  private startCalibrationTimer() {
    this.stopCalibrationTimer();
    this.calibrationTimer = setInterval(() => this.updateCalibrationStatus(), 250);
  }

  private updateCalibrationStatus() {
    if (!this.isCalibrating || !this.calibrationStartedAt) return;

    const elapsedMs = Date.now() - this.calibrationStartedAt;
    const remainingMs = Math.max(0, GPS_CALIBRATION_MS - elapsedMs);
    this.calibrationSecondsRemaining = Math.ceil(remainingMs / 1000);

    if (remainingMs > 0) {
      this.statusText = `Calibrating GPS. Keep still for ${this.calibrationSecondsRemaining}s.`;
      return;
    }

    if (this.calibrationFixes < GPS_REQUIRED_FIXES) {
      this.statusText = 'Calibrating GPS. Waiting for a stable signal...';
    }

    if (elapsedMs >= GPS_CALIBRATION_TIMEOUT_MS && this.bestCalibrationPosition) {
      this.completeCalibration(this.bestCalibrationPosition);
    }
  }

  private stopCalibrationTimer() {
    if (this.calibrationTimer) {
      clearInterval(this.calibrationTimer);
      this.calibrationTimer = null;
    }
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

  // gets weather for current location (GPS), wherever the phone is
  private loadWeather() {
    this.weatherLoading = true;
    this.weatherError = '';

    if (!navigator.geolocation) {
      this.loadWeatherForFallbackCity();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (this.map && !this.isTracking) {
          this.map.setView([latitude, longitude], 17);
        }
        this.weatherService.getWeatherByCoords(latitude, longitude).subscribe({
          next: (summary) => {
            this.weather = summary;
            this.weatherLoading = false;
          },
          error: () => {
            this.weatherError = 'Unable to load weather right now.';
            this.weatherLoading = false;
          },
        });
      },
      () => this.loadWeatherForFallbackCity(),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }

  private loadWeatherForFallbackCity() {
    this.weatherService.getCityWeather(WEATHER_FALLBACK_CITY).subscribe({
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

  uvLabel(uv: number): string {
    if (uv < 3) return 'Low';
    if (uv < 6) return 'Moderate';
    if (uv < 8) return 'High';
    if (uv < 11) return 'Very high';
    return 'Extreme';
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

  get weatherTheme(): 'rain' | 'sun' | 'neutral' {
    if (!this.weather) return 'neutral';
    if (this.weather.willRain) return 'rain';
    if ([0, 1, 2].includes(this.weather.weatherCode)) return 'sun';
    return 'neutral';
  }

  toggleWeatherDetails() {
    this.weatherExpanded = !this.weatherExpanded;
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  toggleActivityDetails() {
    this.activityExpanded = !this.activityExpanded;
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  blockNavigation(event: Event) {
    if (!this.isTracking) return;
    event.preventDefault();
    event.stopPropagation();
    this.message.warning('Stop the active workout before leaving this page.');
  }

  canLeaveRunning(): boolean {
    if (!this.isTracking) return true;
    this.message.warning('Stop the active workout before leaving this page.');
    return false;
  }
}

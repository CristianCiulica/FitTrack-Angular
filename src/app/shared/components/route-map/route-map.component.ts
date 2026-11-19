import { MAP_TILE_URL, MAP_TILE_OPTIONS } from '../../../core/config/map-tiles';
import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, inject, NgZone } from '@angular/core';
import * as L from 'leaflet';
import { validRoute } from '../../../core/utils/route';

@Component({
  selector: 'app-route-map',
  standalone: true,
  template: `
    <div #mapCanvas class="route-map" [attr.aria-label]="label" role="img"></div>
    @if (!hasRoute) { <div class="route-empty">No GPS route recorded</div> }
    @if (hasRoute) {
      <div class="route-key" aria-hidden="true"><i></i> Start <i class="finish"></i> Finish</div>
    }
  `,
  styles: `
    :host { display: block; position: relative; height: 220px; overflow: hidden; border-radius: 20px; background: var(--surface-strong); isolation: isolate; }
    .route-map { width: 100%; height: 100%; z-index: 0; }
    .route-empty { position: absolute; inset: 0; display: grid; place-items: center; color: var(--ink-secondary); font-size: 13px; background: var(--surface-strong); }
    .route-key { position: absolute; top: 12px; left: 12px; display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 20px; color: var(--ink); background: var(--surface-strong); border: 1px solid var(--glass-border); font-size: 10px; font-weight: 600; pointer-events: none; }
    i { width: 7px; height: 7px; border-radius: 50%; background: #158653; }
    i.finish { background: #3987ff; margin-left: 5px; }
    :host ::ng-deep .leaflet-control-attribution { font-size: 9px; color: var(--ink-secondary); background: var(--surface-strong); }
  `,
})
export class RouteMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() route?: [number, number][];
  @Input() label = 'Recorded running route';
  @ViewChild('mapCanvas', { static: true }) canvas!: ElementRef<HTMLElement>;
  hasRoute = false;
  private map?: L.Map;
  private layers?: L.LayerGroup;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private frame?: number;
  private destroyed = false;
  private viewReady = false;
  private readonly zone = inject(NgZone);

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.zone.runOutsideAngular(() => this.observeVisibility());
  }

  private observeVisibility(): void {
    // Do not request tiles for every history item before it comes into view.
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          this.initMap();
          this.intersectionObserver?.disconnect();
          this.intersectionObserver = undefined;
        }
      }, { rootMargin: '180px' });
      this.intersectionObserver.observe(this.canvas.nativeElement);
    } else {
      this.initMap();
    }
  }

  ngOnChanges(): void {
    this.hasRoute = validRoute(this.route).length > 0;
    if (this.map) this.drawRoute();
    else if (this.viewReady && this.hasRoute && !this.intersectionObserver) this.initMap();
  }

  private initMap(): void {
    if (this.destroyed || this.map || !this.hasRoute) return;
    this.map = L.map(this.canvas.nativeElement, {
      zoomControl: false, dragging: false, scrollWheelZoom: false, touchZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, attributionControl: true,
    });
    this.map.attributionControl.setPrefix(false);
    L.tileLayer(MAP_TILE_URL, MAP_TILE_OPTIONS).addTo(this.map);
    this.layers = L.layerGroup().addTo(this.map);
    this.drawRoute();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.frame !== undefined) cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => {
          this.map?.invalidateSize({ animate: false });
          this.fitRoute();
        });
      });
      this.resizeObserver.observe(this.canvas.nativeElement);
    }
  }

  private drawRoute(): void {
    if (!this.map || !this.layers) return;
    this.layers.clearLayers();
    const points = validRoute(this.route);
    if (!points.length) return;
    L.polyline(points, { color: '#16325b', weight: 7, opacity: .55, interactive: false }).addTo(this.layers);
    L.polyline(points, { color: '#3987ff', weight: 4, interactive: false }).addTo(this.layers);
    L.circleMarker(points[0], { radius: 5, color: '#fff', weight: 2, fillColor: '#158653', fillOpacity: 1, interactive: false }).addTo(this.layers);
    if (points.length > 1) L.circleMarker(points[points.length - 1], { radius: 5, color: '#fff', weight: 2, fillColor: '#3987ff', fillOpacity: 1, interactive: false }).addTo(this.layers);
    this.fitRoute();
  }

  private fitRoute(): void {
    const points = validRoute(this.route);
    if (points.length && this.map) this.map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 17, animate: false });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.map?.remove();
    this.map = undefined;
  }
}

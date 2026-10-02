import type { TileLayerOptions } from 'leaflet';

// CARTO's public raster endpoint now requires an API key. Use the standard OSM
// layer with visible credit and normal browser caching (no offline prefetch).
export const MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_TILE_OPTIONS: TileLayerOptions = {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  referrerPolicy: 'strict-origin-when-cross-origin',
  updateWhenIdle: true,
  keepBuffer: 1,
};

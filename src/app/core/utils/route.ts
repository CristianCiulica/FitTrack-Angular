export type RoutePoint = [number, number];

/** Cached routes may predate API validation. Never hand invalid coordinates to Leaflet. */
export function validRoute(route: unknown): RoutePoint[] {
  if (!Array.isArray(route)) return [];
  return route.filter((point): point is RoutePoint =>
    Array.isArray(point) && point.length === 2 &&
    Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
    Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180,
  );
}

/** Match the API's point limit while retaining the complete run and both endpoints. */
export function routeForStorage(route: unknown, maxPoints = 5000): RoutePoint[] {
  const points = validRoute(route);
  const limit = Math.max(2, Math.floor(maxPoints));
  if (points.length <= limit) return points.map(([lat, lng]) => [lat, lng]);
  return Array.from({ length: limit }, (_, index) => {
    const [lat, lng] = points[Math.round(index * (points.length - 1) / (limit - 1))];
    return [lat, lng];
  });
}

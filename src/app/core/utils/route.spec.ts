import { routeForStorage, validRoute } from './route';

describe('GPS route validation and persistence', () => {
  it('rejects malformed cached points without dropping valid equator coordinates', () => {
    expect(validRoute([[0, 0], [44, 26], [91, 0], [0, -181], [NaN, 2], [1], null, ['44', 26]]))
      .toEqual([[0, 0], [44, 26]]);
  });

  it('retains both ends of a long run within the API limit', () => {
    const route = Array.from({ length: 14000 }, (_, i) => [44 + i / 100000, 26] as [number, number]);
    const saved = routeForStorage(route);
    expect(saved).toHaveLength(5000);
    expect(saved[0]).toEqual(route[0]);
    expect(saved.at(-1)).toEqual(route.at(-1));
    expect(saved.every((p, i) => !i || p[0] > saved[i - 1][0])).toBe(true);
  });

  it('snapshots route coordinates so starting a new run cannot mutate a pending save', () => {
    const route: [number, number][] = [[44, 26], [44.1, 26.1]];
    const saved = routeForStorage(route);
    route[0][0] = 20;
    route.splice(1);
    expect(saved).toEqual([[44, 26], [44.1, 26.1]]);
  });
});

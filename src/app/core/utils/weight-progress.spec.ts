import { weightChart, localDateKey, POUNDS_PER_KG } from './weight-progress';
describe('Weight progress chart', () => {
  const today = new Date(2026,9,3);
  it('handles empty and single-point histories without invalid coordinates', () => {
    expect(weightChart([],30,today).points).toEqual([]);
    const result = weightChart([{date:'2026-10-03',weightKg:75}],30,today);
    expect(result.points[0].x).toBe(180);
    expect(result.points[0].y).toBe(90);
    expect(result.change).toBeNull();
  });
  it('spaces points by elapsed days, not entry index, and converts units', () => {
    const result = weightChart([{date:'2026-10-03',weightKg:74},{date:'2026-09-04',weightKg:75},{date:'2026-09-05',weightKg:75}],30,today,true);
    expect(result.points[1].x - result.points[0].x).toBeCloseTo(344/29);
    expect(result.change).toBeCloseTo(-POUNDS_PER_KG);
    expect(result.path).not.toContain('NaN');
  });
  it('excludes future entries and dates outside the inclusive local calendar window', () => {
    const data = [{date:'2026-09-03',weightKg:76},{date:'2026-09-04',weightKg:75},{date:'2026-10-04',weightKg:74}];
    expect(weightChart(data,30,today).points.map(p=>p.date)).toEqual(['2026-09-04']);
    expect(localDateKey(today)).toBe('2026-10-03');
    expect(weightChart(data,0,today).points).toHaveLength(2);
  });
});

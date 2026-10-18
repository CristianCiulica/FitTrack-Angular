import { weightJourney } from './weight-journey';
describe('Profile weight comparison', () => {
  it('uses the earliest saved weigh-in, the current profile weight and calendar days', () => {
    const result = weightJourney(
      [
        { date: '2026-10-01', weightKg: 78 },
        { date: '2026-03-28', weightKg: 82 },
      ],
      77.5,
      'metric',
      new Date(2026, 2, 30, 0, 15),
    );
    expect(result).toEqual({ start: 82, current: 77.5, startedOn: '2026-03-28', elapsedDays: 2 });
  });
  it('does not invent a starting date and converts both weights to the chosen units', () => {
    expect(weightJourney([], 80, 'metric').start).toBeNull();
    expect(weightJourney([], 80, 'metric').elapsedDays).toBeNull();
    const result = weightJourney(
      [{ date: '2026-10-01', weightKg: 80 }],
      79,
      'imperial',
      new Date(2026, 9, 18),
    );
    expect(result.start).toBeCloseTo(176.4, 1);
    expect(result.current).toBeCloseTo(174.2, 1);
    expect(result.elapsedDays).toBe(17);
  });
});

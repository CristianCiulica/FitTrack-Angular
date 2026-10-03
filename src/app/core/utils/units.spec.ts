import {
  displayWeight,
  displayDistance,
  displaySpeed,
  toCanonicalWeight,
  cmToFeetInches,
} from './units';

describe('Consistent units', () => {
  it('keeps a daily weigh-in decimal visible in account and nutrition', () => {
    expect(displayWeight(74.2, 'metric')).toBe(74.2);
    expect(displayWeight(74.2, 'imperial')).toBe(163.6);
    expect(toCanonicalWeight(163.6, 'imperial')).toBe(74.2);
  });
  it('uses miles for distances and speed in imperial mode', () => {
    expect(displayDistance(1609.344, 'imperial')).toBeCloseTo(1);
    expect(displaySpeed(1.609344, 'imperial')).toBeCloseTo(1);
    expect(displayDistance(1000, 'metric')).toBe(1);
  });
  it('carries rounded height inches into the next foot', () => {
    expect(cmToFeetInches(182.8)).toEqual({ feet: 6, inches: 0 });
  });
});

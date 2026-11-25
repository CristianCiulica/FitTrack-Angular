import { recordKilometres, runSplits } from './run-splits';

describe('kilometre splits', () => {
  it('interpolates every kilometre crossed between accepted fixes', () => {
    const times: number[] = [];
    recordKilometres(times, 900, 2100, 270, 630);
    expect(times).toEqual([300, 600]);
    expect(runSplits({ kilometreTimes: times, durationSeconds: 660, distanceMeters: 2200 })).toEqual([
      { metres: 1000, seconds: 300 }, { metres: 1000, seconds: 300 }, { metres: 200, seconds: 60 },
    ]);
  });
  it('keeps sub-kilometre runs and omits a trailing row at an exact boundary', () => {
    expect(runSplits({ kilometreTimes: [], durationSeconds: 20, distanceMeters: 65 })).toEqual([{ metres: 65, seconds: 20 }]);
    expect(runSplits({ kilometreTimes: [299.7], durationSeconds: 310, distanceMeters: 1000 })).toEqual([{ metres: 1000, seconds: 299 }]);
  });
  it('does not invent times from aggregate or damaged history', () => {
    const session = { durationSeconds: 600, distanceMeters: 2100 };
    expect(runSplits(session)).toEqual([]);
    expect(runSplits({ ...session, kilometreTimes: [300] })).toEqual([]);
    expect(runSplits({ ...session, kilometreTimes: [300, 290] })).toEqual([]);
  });
});

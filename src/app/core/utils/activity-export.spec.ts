import { achievementReportHtml, compactActivityExport, ActivityExport } from './activity-export';
const data: ActivityExport = {
  exportedAt: '2026-10-23',
  profile: {
    displayName: '<script>alert(1)</script>',
    avatar: 'data:image/png;BASE64',
    units: 'metric',
    weightKg: 75,
  } as any,
  weightEntries: [
    { date: '2026-10-01', weightKg: 78 },
    { date: '2026-10-23', weightKg: 75 },
  ],
  workouts: [
    {
      id: 'private',
      userId: 'uid',
      kind: 'session',
      name: 'Push',
      date: '2026-10-01',
      notes: 'internal metadata',
      durationSeconds: 1200,
      exercises: [
        {
          exerciseName: 'Press',
          muscleGroup: 'Chest',
          sets: 1,
          reps: 10,
          weight: 40,
          setWeights: [40],
          setReps: [10],
        },
      ],
    },
  ],
  runningSessions: [
    {
      id: 'run',
      userId: 'uid',
      mode: 'running',
      startedAt: '2026-10-01T10:00Z',
      endedAt: '2026-10-01T10:10Z',
      durationSeconds: 600,
      distanceMeters: 1000,
      steps: 1500,
      averageSpeedKmh: 6,
      calories: 80,
      route: [[44, 26]],
    },
  ],
};
describe('Activity exports', () => {
  it('keeps meaningful measurements but omits routes, avatars, account ids and internal notes', () => {
    const json = JSON.stringify(compactActivityExport(data));
    expect(json).not.toContain('BASE64');
    expect(json).not.toContain('internal metadata');
    expect(json).not.toContain('route');
    expect(json).not.toContain('uid');
    expect(json).toContain('40,10');
    expect(json).toContain('1000');
  });
  it('includes badges, personal records, activity and weight progress while escaping user text', () => {
    const html = achievementReportHtml(data);
    expect(html).toContain('The first step');
    expect(html).not.toContain('Press');
    expect(html).not.toContain('<table>');
    expect(html).toContain('exercises tracked');
    expect(html).toContain('400 kg');
    expect(html).toContain('78 kg');
    expect(html).toContain('75 kg');
    expect(html).toContain('Longest session');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

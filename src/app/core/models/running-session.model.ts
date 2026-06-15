export interface RunningSession {
  id: string;
  userId: string;
  mode: 'running' | 'walking';
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  steps: number;
  averageSpeedKmh: number;
  calories: number;
}

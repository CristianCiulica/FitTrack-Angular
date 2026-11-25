export interface RunningSession {
  id: string;
  clientId?: string;
  userId: string;
  mode: 'running' | 'walking';
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  /** Cumulative active seconds at each full kilometre. Older runs have no timings. */
  kilometreTimes?: number[];
  steps: number;
  averageSpeedKmh: number;
  calories: number;
  /** traseul GPS: perechi [lat, lng] */
  route?: [number, number][];
}

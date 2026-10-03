import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { RunningSession } from '../models/running-session.model';

export interface NativeRunSnapshot {
  active: boolean;
  session?: Omit<RunningSession, 'id'> & { gpsAccuracy?: number; trackingError?: string };
}
interface RunPlugin {
  start(options: { session: Omit<RunningSession, 'id'> }): Promise<void>;
  snapshot(options: { owner: string }): Promise<NativeRunSnapshot>;
  stop(options: { owner: string }): Promise<NativeRunSnapshot>;
  clear(options: { owner: string }): Promise<void>;
}
const plugin = registerPlugin<RunPlugin>('FitTrackRun');

@Injectable({ providedIn: 'root' })
export class NativeRunService {
  readonly available = Capacitor.getPlatform() === 'android';
  start(session: Omit<RunningSession, 'id'>) {
    return plugin.start({ session });
  }
  snapshot(owner: string) {
    return plugin.snapshot({ owner });
  }
  stop(owner: string) {
    return plugin.stop({ owner });
  }
  clear(owner: string) {
    return this.available ? plugin.clear({ owner }) : Promise.resolve();
  }
}

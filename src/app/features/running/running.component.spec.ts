import { vi } from 'vitest';
import { of } from 'rxjs';
import { RunningComponent } from './running.component';
import { AuthService } from '../../core/services/auth.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { RunningSessionService } from '../../core/services/running-session.service';
import { WeatherService } from '../../core/services/weather.service';
import { NzModalService } from 'ng-zorro-antd/modal';

function fix(accuracy = 8): GeolocationPosition {
  return {
    coords: { latitude: 44.4268, longitude: 26.1025, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
    timestamp: Date.now(),
  } as GeolocationPosition;
}

describe('Running GPS lifecycle', () => {
  let component: RunningComponent;
  const geo = { getCurrentPosition: vi.fn(), watchPosition: vi.fn((_success: PositionCallback, _error?: PositionErrorCallback | null, _options?: PositionOptions) => 7), clearWatch: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
    component = new RunningComponent(
      { currentUserId: 'runner' } as AuthService,
      { error: vi.fn(), success: vi.fn(), warning: vi.fn() } as unknown as NzMessageService,
      { setTrackingActive: vi.fn(), saveSession: vi.fn(() => of({})) } as unknown as RunningSessionService,
      {} as WeatherService,
      {} as NzModalService,
    );
  });

  afterEach(() => {
    component.ngOnDestroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('ignores an old location request after stop and restart', () => {
    component.startTracking();
    const oldSuccess = geo.getCurrentPosition.mock.calls[0][0];
    component.stopTracking(false);
    component.startTracking();
    oldSuccess(fix());
    expect(geo.watchPosition).not.toHaveBeenCalled();
    geo.getCurrentPosition.mock.calls[1][0](fix());
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });

  it('keeps recording through a watch timeout and accepts the next fix', () => {
    component.startTracking();
    geo.getCurrentPosition.mock.calls[0][0](fix());
    const callbacks = geo.watchPosition.mock.calls[0];
    (callbacks[1] as unknown as PositionErrorCallback)({ code: 3 } as GeolocationPositionError);
    expect(component.isTracking).toBe(true);
    expect(geo.clearWatch).not.toHaveBeenCalled();
    (callbacks[0] as unknown as PositionCallback)(fix(6));
    expect(component.gpsAccuracy).toBe(6);
  });

  it('does not seed a route from a wildly inaccurate calibration fix', () => {
    component.startTracking();
    geo.getCurrentPosition.mock.calls[0][0](fix(1200));
    vi.advanceTimersByTime(10000);
    expect(component.isCalibrating).toBe(true);
    expect(component.distanceMeters).toBe(0);
    (geo.watchPosition.mock.calls[0][0] as unknown as PositionCallback)(fix(10));
    vi.advanceTimersByTime(250);
    expect(component.isCalibrating).toBe(false);
  });

  it('ignores queued watch callbacks after the page is destroyed', () => {
    component.startTracking();
    geo.getCurrentPosition.mock.calls[0][0](fix());
    const callback = geo.watchPosition.mock.calls[0][0] as unknown as PositionCallback;
    component.ngOnDestroy();
    callback(fix(1));
    expect(component.gpsAccuracy).toBe(8);
    expect(geo.clearWatch).toHaveBeenCalledWith(7);
  });
});

import { NgZone, SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RouteMapComponent } from './route-map.component';

describe('History map updates', () => {
  it('validates a changed route once and skips redraws when only its label changes', () => {
    const zone = { runOutsideAngular: vi.fn((callback: () => void) => callback()) };
    TestBed.configureTestingModule({ providers: [{ provide: NgZone, useValue: zone }] });
    const component = TestBed.runInInjectionContext(() => new RouteMapComponent());
    const internals = component as unknown as {
      map: object;
      drawRoute: () => void;
      points: [number, number][];
    };
    internals.map = {};
    const draw = vi.spyOn(internals, 'drawRoute').mockImplementation(() => {});
    component.route = [[44, 26], [91, 26], [45, 27]];
    component.ngOnChanges({ route: new SimpleChange(undefined, component.route, true) });
    expect(internals.points).toEqual([[44, 26], [45, 27]]);
    expect(component.hasRoute).toBe(true);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(zone.runOutsideAngular).toHaveBeenCalledTimes(1);

    const validated = internals.points;
    component.ngOnChanges({ label: new SimpleChange('Route', 'Updated route', false) });
    expect(internals.points).toBe(validated);
    expect(draw).toHaveBeenCalledTimes(1);

    component.route = [];
    component.ngOnChanges({ route: new SimpleChange(validated, [], false) });
    expect(component.hasRoute).toBe(false);
    expect(internals.points).toEqual([]);
    expect(draw).toHaveBeenCalledTimes(2);
  });
});

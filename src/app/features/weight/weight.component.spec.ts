import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { NzModalService } from 'ng-zorro-antd/modal';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { WeightService } from '../../core/services/weight.service';
import { WeightEntry } from '../../core/models/weight-entry.model';
import { WeightComponent } from './weight.component';

describe('Weight refresh interaction', () => {
  it('keeps typed input when a background refresh arrives', () => {
    const response = new Subject<WeightEntry[]>();
    TestBed.configureTestingModule({ providers: [
      { provide: WeightService, useValue: { getEntries: () => response } },
      { provide: ProfileService, useValue: { units: signal('metric'), weightKg: signal(75) } },
      { provide: AuthService, useValue: {} }, { provide: NzModalService, useValue: {} },
    ] });
    const component = TestBed.runInInjectionContext(() => new WeightComponent());
    component.ngOnInit();
    response.next([{ date: component.today, weightKg: 75 }]);
    component.weight = 74.2;
    response.next([{ date: component.today, weightKg: 76 }]);
    expect(component.weight).toBe(74.2);
    expect(component.entries()[0].weightKg).toBe(76);
  });
});

import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivityGoalsComponent } from './activity-goals.component';
import { ProfileService } from '../../../core/services/profile.service';
describe('Activity goal saving', () => {
  it('keeps the editor open and reports an API failure instead of claiming success', () => {
    const save = vi.fn(() => throwError(() => new Error('offline')));
    TestBed.configureTestingModule({providers:[{provide:ProfileService,useValue:{moveGoal:()=>500,exerciseGoal:()=>30,weeklyWorkoutGoal:()=>4,saveActivityGoals:save}}]});
    const component = TestBed.runInInjectionContext(() => new ActivityGoalsComponent());
    component.show(); component.move = 0; component.save(); expect(save).not.toHaveBeenCalled();
    component.move = 600; component.save(); expect(component.open()).toBe(true); expect(component.error()).toContain('Could not save');
    save.mockReturnValue(of({}) as any); component.save(); expect(component.open()).toBe(false);
  });
});

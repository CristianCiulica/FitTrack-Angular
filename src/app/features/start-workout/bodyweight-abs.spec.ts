import { of } from 'rxjs';
import { vi } from 'vitest';
import { StartWorkoutComponent } from './start-workout.component';

describe('Bodyweight abs logging', () => {
  let component: StartWorkoutComponent;
  const save = vi.fn((w: any)=>of({...w,id:'saved'}));
  beforeEach(()=>{
    vi.useFakeTimers();localStorage.clear();save.mockClear();
    component = new StartWorkoutComponent({currentUserId:'abs-test'} as any,{getWorkouts:()=>of([{userId:'abs-test',name:'Legs',date:'2026-10-01',kind:'session',exercises:[{exerciseName:'Leg Raises',muscleGroup:'Core',sets:1,reps:17,weight:20}]}]),addWorkout:save,isDurablySaved:()=>true} as any,{weightKg:()=>75} as any,{success:vi.fn(),error:vi.fn(),warning:vi.fn()} as any,{queryParams:of({})} as any,{confirm:vi.fn()} as any);
  });
  afterEach(()=>{component.ngOnDestroy();vi.useRealTimers()});
  it.each(['Leg Raises','Crunches','Abdominal Crunches'])('keeps reps and saves zero added load for %s',name=>{
    component.selectRoutine({name:'Abs',exercises:[{name,sets:1,reps:15,weight:30,muscleGroup:'Core'}]},'abs');component.startWorkout();
    expect(component.bodyweightActive()).toBe(true);expect(component.currentWeight()).toBe(0);
    component.usePreviousValues(50,18);expect(component.currentWeight()).toBe(0);expect(component.currentReps()).toBe(18);
    component.currentWeight.set(99);component.finishSet();component.skipRest();component.finishWorkout();
    expect(save.mock.calls[0][0].exercises[0]).toMatchObject({sets:1,reps:18,weight:0,setWeights:[0],setReps:[18]});
  });
  it('does not change weighted machine crunch exercises',()=>{
    component.selectRoutine({name:'Core',exercises:[{name:'Crunch (Machine)',sets:1,reps:12,weight:30,muscleGroup:'Core'}]},'core');component.startWorkout();expect(component.bodyweightActive()).toBe(false);expect(component.currentWeight()).toBe(30);
  });
});

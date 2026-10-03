import { previousExercises, workoutVolume } from './workout-history';
import { Workout } from '../models/workout.model';
const workout = (date: string, overrides: Partial<Workout> = {}): Workout => ({date, name:'Press day',userId:'u',exercises:[{exerciseName:'  Bench   Press ',muscleGroup:'Chest',sets:2,weight:70,reps:10,setWeights:[60,70],setReps:[10,6]}],...overrides});
describe('Previous exercise matching', () => {
  it('preserves the actual reps and weight pair for each set including zero load', () => {
    const entries = previousExercises([workout('2026-10-01')], '2026-10-03');
    expect(entries.get('bench press')?.pairs).toEqual([{weight:60,reps:10},{weight:70,reps:6}]);
    expect(workoutVolume(workout('2026-10-01'))).toBe(1020);
  });
  it('ignores templates and future dates and prefers the newest same-day session', () => {
    const entries = previousExercises([
      workout('2026-10-01',{createdAt:new Date('2026-10-01T12:00Z')}),
      workout('2026-10-01',{createdAt:new Date('2026-10-01T18:00Z'),exercises:[{exerciseName:'Bench Press',muscleGroup:'Chest',sets:1,weight:0,reps:8}]}),
      workout('2026-10-04'),workout('2026-10-03',{isPredefined:true}),
    ],'2026-10-03');
    expect(entries.get('bench press')?.pairs).toEqual([{weight:0,reps:8}]);
  });
});

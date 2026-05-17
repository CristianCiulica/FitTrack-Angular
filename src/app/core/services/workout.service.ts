import { Injectable, signal, computed, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
} from '@angular/fire/firestore';
import { Auth, user } from '@angular/fire/auth';
import { Workout } from '../models/workout.model';
import { Observable, of, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  totalWorkouts = signal<number>(0);
  workouts = signal<Workout[]>([]);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly authState$ = user(this.auth);

  totalVolume = computed(() =>
    this.workouts().reduce((acc, w) => acc + w.sets * w.reps * w.weight, 0),
  );

  getWorkouts(): Observable<Workout[]> {
    return this.authState$.pipe(
      switchMap((u) => {
        if (!u) return of([]);
        const ref = collection(this.firestore, 'workouts');
        const q = query(ref, where('userId', '==', u.uid), orderBy('date', 'desc'));
        return collectionData(q, { idField: 'id' }) as Observable<Workout[]>;
      }),
    );
  }

  addWorkout(workout: Omit<Workout, 'id'>) {
    const ref = collection(this.firestore, 'workouts');
    return from(addDoc(ref, { ...workout, createdAt: new Date() }));
  }

  updateWorkout(id: string, workout: Partial<Workout>) {
    const ref = doc(this.firestore, 'workouts', id);
    return from(updateDoc(ref, workout));
  }

  deleteWorkout(id: string) {
    const ref = doc(this.firestore, 'workouts', id);
    return from(deleteDoc(ref));
  }
}

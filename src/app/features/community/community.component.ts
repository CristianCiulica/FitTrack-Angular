import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';

import { CommunityService } from '../../core/services/community.service';
import { WorkoutService } from '../../core/services/workout.service';
import { CommunityWorkout, Workout } from '../../core/models/workout.model';
import { ProfileService } from '../../core/services/profile.service';
import { displayWeight } from '../../core/utils/units';
import { estimateSessionCalories, estimateSessionMinutes } from '../../core/utils/workout-calories';
import { WorkoutModalComponent } from '../../shared/components/workout-modal/workout-modal.component';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzLayoutModule,
    NzCardModule,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
    NzSpinModule,
    NzEmptyModule,
    WorkoutModalComponent,
  ],
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.scss'],
})
export class CommunityComponent implements OnInit {
  private readonly communityService = inject(CommunityService);
  private readonly workoutService = inject(WorkoutService);
  private readonly profileService = inject(ProfileService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);

  readonly workouts = this.communityService.communityWorkouts;
  readonly loading = this.communityService.loading;
  readonly units = this.profileService.units;

  readonly savingIds = signal<Set<string>>(new Set());
  readonly shareModalVisible = signal(false);
  readonly loadError = signal(false);

  ngOnInit(): void {
    this.loadCommunity();
  }

  // fara toast: o eroare tranzitorie (ex. token inca neincarcat la boot) afiseaza
  // o stare inline cu buton de reincercare, nu o notificare suparatoare
  loadCommunity(): void {
    this.loadError.set(false);
    this.communityService.loadCommunityWorkouts().subscribe({
      error: () => this.loadError.set(true),
    });
  }

  saveToMyWorkouts(cw: CommunityWorkout): void {
    this.savingIds.update((set) => new Set(set).add(cw.id));

    // Convert to a personal workout
    const newWorkout: Omit<Workout, 'id'> = {
      userId: '', // backend will set this
      name: cw.name,
      date: new Date().toISOString(),
      notes: `Saved from ${cw.authorName}`,
      isPredefined: false,
      exercises: cw.exercises,
    };

    this.workoutService.addWorkout(newWorkout).subscribe({
      next: () => {
        this.message.success('Saved to your workouts!');
        this.savingIds.update((set) => {
          const newSet = new Set(set);
          newSet.delete(cw.id);
          return newSet;
        });
      },
      error: () => {
        this.message.error('Failed to save workout');
        this.savingIds.update((set) => {
          const newSet = new Set(set);
          newSet.delete(cw.id);
          return newSet;
        });
      },
    });
  }

  onShareSave(workout: Partial<Workout>) {
    const payload = {
      name: workout.name || 'My workout',
      description: workout.notes || '',
      exercises: workout.exercises || []
    };

    this.communityService.publishWorkout(payload).subscribe({
      next: () => {
        this.shareModalVisible.set(false);
        this.message.success('Workout shared to community!');
        this.communityService.loadCommunityWorkouts().subscribe();
      },
      error: () => this.message.error('Failed to share workout')
    });
  }

  getMuscleGroups(cw: CommunityWorkout): string[] {
    const groups = new Set<string>();
    for (const e of cw.exercises) {
      groups.add(e.muscleGroup);
    }
    return Array.from(groups);
  }

  formatWeight(w: number): string {
    // Note: community workouts are saved in metric (canonical)
    const val = displayWeight(w, this.units());
    const unitStr = this.units() === 'imperial' ? 'lb' : 'kg';
    return `${val} ${unitStr}`;
  }

  /* ------- helpere de prezentare, in limbajul vizual al aplicatiei ------- */

  workoutKcal(cw: CommunityWorkout): number {
    return estimateSessionCalories(cw.exercises, this.profileService.weightKg());
  }

  workoutMinutes(cw: CommunityWorkout): number {
    return estimateSessionMinutes(cw.exercises);
  }

  authorInitials(name: string): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.length === 1
      ? parts[0].charAt(0).toUpperCase()
      : (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  // tonuri alternante, la fel ca pe cardurile din Your plan
  cardTone(index: number): string {
    return ['blue', 'purple', 'cyan', 'green'][index % 4];
  }

  // aceleasi culori pe grupe musculare ca in History
  private readonly muscleTones: Record<string, string> = {
    Chest: 'blue',
    Back: 'green',
    Shoulders: 'purple',
    Arms: 'cyan',
    Legs: 'indigo',
    Core: 'pink',
    Cardio: 'red',
    'Full Body': 'graphite',
  };

  muscleTone(muscleGroup: string): string {
    return this.muscleTones[muscleGroup] ?? 'graphite';
  }
}

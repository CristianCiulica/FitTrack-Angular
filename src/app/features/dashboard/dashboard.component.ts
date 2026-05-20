import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { WorkoutService } from '../../core/services/workout.service';
import { AuthService } from '../../core/services/auth.service';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Workout } from '../../core/models/workout.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    NzLayoutModule,
    NzMenuModule,
    NzCardModule,
    NzStatisticModule,
    NzIconModule,
    NzButtonModule,
    NzAvatarModule,
    NzDropDownModule,
    NzTagModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  workouts = signal<Workout[]>([]);
  isCollapsed = false;

  totalWorkouts = computed(() => this.workouts().length);
  totalVolume = computed(() =>
    this.workouts().reduce((acc, w) => {
      const vol = w.exercises?.reduce((eAcc, e) => eAcc + e.sets * e.reps * e.weight, 0) || 0;
      return acc + vol;
    }, 0)
  );
  thisWeekWorkouts = computed(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return this.workouts().filter(w => new Date(w.date) >= weekAgo).length;
  });
  mostUsedMuscle = computed(() => {
    const map = new Map<string, number>();
    this.workouts().forEach(w => {
      w.exercises?.forEach(ex => {
        map.set(ex.muscleGroup, (map.get(ex.muscleGroup) ?? 0) + 1);
      });
    });
    let max = 0, muscle = '-';
    map.forEach((v, k) => { if (v > max) { max = v; muscle = k; } });
    return muscle;
  });
  recentWorkouts = computed(() => [...this.workouts()].slice(0, 5));

  userName = computed(() => {
    const u = this.authService.currentUser();
    return u?.displayName ?? u?.email ?? 'Athlete';
  });

  constructor(
    private workoutService: WorkoutService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    this.workoutService.getWorkouts().subscribe(data => {
      this.workouts.set(data);
      this.workoutService.workouts.set(data);
      this.workoutService.totalWorkouts.set(data.length);
    });
  }

  logout() {
    this.authService.logout().subscribe();
  }
}

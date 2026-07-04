import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-bmi',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    NzLayoutModule,
    NzMenuModule,
    NzButtonModule,
    NzIconModule,
    NzCardModule,
    NzInputNumberModule,
    NzTagModule
  ],
  templateUrl: './bmi.component.html',
  styleUrls: ['./bmi.component.scss']
})
export class BmiComponent {
  height = signal<number>(170); // cm
  weight = signal<number>(70);  // kg
  age = signal<number>(30);
  sex = signal<'male' | 'female'>('male');
  strengthTrainingDays = signal<number>(4);
  goal = signal<'lose' | 'gain'>('lose');
  goalRate = signal<number>(0.5);

// folosim computed pentru valori calc automat
  bmi = computed(() => {
    const h = this.height() / 100;
    const w = this.weight();
    if (h === 0) return '0.0';
    return (w / (h * h)).toFixed(1);
  });

  bmiCategory = computed(() => {
    const value = parseFloat(this.bmi());
    if (value < 18.5) return { text: 'Underweight', color: 'orange' };
    if (value < 25) return { text: 'Healthy weight', color: 'green' };
    if (value < 30) return { text: 'Overweight', color: 'orange' };
    return { text: 'Obesity', color: 'red' };
  });

  activityFactor = computed(() => {
    const days = this.strengthTrainingDays();
    if (days <= 0) return 1.2;
    if (days <= 2) return 1.375;
    if (days <= 4) return 1.55;
    if (days <= 6) return 1.725;
    return 1.9;
  });

  basalCalories = computed(() => {
    const base =
      10 * this.weight() +
      6.25 * this.height() -
      5 * this.age();
    return Math.round(base + (this.sex() === 'male' ? 5 : -161));
  });

  maintenanceCalories = computed(() =>
    Math.round(this.basalCalories() * this.activityFactor()),
  );

  calorieAdjustment = computed(() =>
    Math.round((this.goalRate() * 7700) / 7),
  );

  targetCalories = computed(() => {
    const target =
      this.goal() === 'lose'
        ? this.maintenanceCalories() - this.calorieAdjustment()
        : this.maintenanceCalories() + this.calorieAdjustment();
    return Math.max(this.basalCalories(), Math.round(target));
  });

  setGoal(goal: 'lose' | 'gain') {
    this.goal.set(goal);
    if (goal === 'gain' && this.goalRate() > 0.5) {
      this.goalRate.set(0.5);
    }
  }

  constructor(private authService: AuthService) {}

  logout() {
    this.authService.logout().subscribe();
  }
}

import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
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
    NzAvatarModule,
    NzCardModule,
    NzInputNumberModule,
    NzTagModule
  ],
  templateUrl: './bmi.component.html',
  styleUrls: ['./bmi.component.scss']
})
export class BmiComponent {
  isCollapsed = false;

  height = signal<number>(170); // cm
  weight = signal<number>(70);  // kg

  userName = computed(() => {
    const u = this.authService.currentUser();
    return u?.displayName ?? u?.email ?? 'Athlete';
  });

  bmi = computed(() => {
    const h = this.height() / 100; // in meters
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

  constructor(private authService: AuthService) {}

  logout() {
    this.authService.logout().subscribe();
  }
}

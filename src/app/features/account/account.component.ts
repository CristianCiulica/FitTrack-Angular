import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { Sex } from '../../core/models/user-profile.model';
import {
  cmToFeetInches,
  displayWeight,
  feetInchesToCm,
  toCanonicalWeight,
  weightUnitLabel,
} from '../../core/utils/units';

@Component({
  selector: 'app-account',
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
    AppMenuComponent,
  ],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);

  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly displayName = this.profileService.displayName;
  readonly avatar = computed(() => this.profileService.profile()?.avatar ?? '');
  readonly email = computed(() => this.profileService.profile()?.email ?? '');

  // stare canonica metrica; unitatile afecteaza doar afisarea
  readonly name = signal('');
  readonly age = signal<number>(25);
  readonly heightCm = signal<number>(170);
  readonly weightKg = signal<number>(70);
  readonly sex = signal<Sex>('male');

  readonly units = this.profileService.units;
  readonly isImperial = computed(() => this.units() === 'imperial');
  readonly weightUnit = computed(() => weightUnitLabel(this.units()));

  readonly weightInput = computed(() => displayWeight(this.weightKg(), this.units()));
  readonly feet = computed(() => cmToFeetInches(this.heightCm()).feet);
  readonly inches = computed(() => cmToFeetInches(this.heightCm()).inches);

  readonly bmi = computed(() => {
    const h = this.heightCm() / 100;
    if (h <= 0) return 0;
    return this.weightKg() / (h * h);
  });
  readonly bmiLabel = computed(() => this.bmi().toFixed(1));
  readonly bmiCategory = computed(() => {
    const value = this.bmi();
    if (value < 18.5) return { text: 'Underweight', tone: 'low' };
    if (value < 25) return { text: 'Healthy weight', tone: 'good' };
    if (value < 30) return { text: 'Overweight', tone: 'mid' };
    return { text: 'Obesity', tone: 'high' };
  });

  ngOnInit(): void {
    this.profileService.load().subscribe(() => this.hydrate());
    this.hydrate();
  }

  private hydrate(): void {
    const p = this.profileService.profile();
    if (!p) return;
    this.name.set(p.displayName ?? '');
    if (p.age) this.age.set(p.age);
    if (p.heightCm) this.heightCm.set(p.heightCm);
    if (p.weightKg) this.weightKg.set(p.weightKg);
    this.sex.set(p.sex ?? 'male');
  }

  onWeightInput(value: number): void {
    this.weightKg.set(toCanonicalWeight(value, this.units()));
  }

  onFeetInput(value: number): void {
    this.heightCm.set(feetInchesToCm(value, this.inches()));
  }

  onInchesInput(value: number): void {
    this.heightCm.set(feetInchesToCm(this.feet(), value));
  }

  save(): void {
    this.saving.set(true);
    this.profileService
      .patch({
        displayName: this.name().trim(),
        age: this.age(),
        heightCm: Math.round(this.heightCm()),
        weightKg: Math.round(this.weightKg() * 10) / 10,
        sex: this.sex(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.success('Profile saved.');
        },
        error: () => {
          this.saving.set(false);
          this.message.error('Could not save. Please try again.');
        },
      });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.message.error('Please choose an image file.');
      return;
    }

    this.uploading.set(true);
    this.resizeImage(file)
      .then((dataUrl) =>
        this.profileService.patch({ avatar: dataUrl }).subscribe({
          next: () => {
            this.uploading.set(false);
            this.message.success('Profile photo updated!');
          },
          error: () => {
            this.uploading.set(false);
            this.message.error('Could not save the photo.');
          },
        }),
      )
      .catch(() => {
        this.uploading.set(false);
        this.message.error('Could not read the image.');
      });
  }

  removeAvatar(): void {
    this.profileService.patch({ avatar: '' }).subscribe({
      next: () => this.message.success('Profile photo removed.'),
      error: () => this.message.error('Could not remove the photo.'),
    });
  }

  // redimensionam client-side la 256x256 (crop central) ca sa incapa in profil
  private resizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('no canvas'));
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => reject(new Error('bad image'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(file);
    });
  }

  initials(name: string): string {
    const parts = (name || '').trim().split(/[\s@.]+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.length === 1
      ? parts[0].charAt(0).toUpperCase()
      : (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}

import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
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
  formatHeight,
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
    NzIconModule,
    AppMenuComponent,
  ],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);

  private readonly destroy = inject(DestroyRef);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly loading = signal(true);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  private readonly baseline = signal('');
  readonly displayName = this.profileService.displayName;
  readonly avatar = computed(() => this.profileService.profile()?.avatar ?? '');
  readonly email = computed(() => this.profileService.profile()?.email ?? '');
  readonly name = signal('');
  readonly age = signal<number | null>(null);
  readonly heightCm = signal<number | null>(null);
  readonly weightKg = signal<number | null>(null);
  readonly sex = signal<Sex>('');
  readonly units = this.profileService.units;
  readonly isImperial = computed(() => this.units() === 'imperial');
  readonly weightUnit = computed(() => weightUnitLabel(this.units()));
  readonly weightInput = computed(() =>
    this.weightKg() == null ? null : displayWeight(this.weightKg()!, this.units()),
  );
  readonly feet = computed(() =>
    this.heightCm() == null ? null : cmToFeetInches(this.heightCm()!).feet,
  );
  readonly inches = computed(() =>
    this.heightCm() == null ? null : cmToFeetInches(this.heightCm()!).inches,
  );
  readonly savedWeight = computed(() => {
    const kg = this.profileService.profile()?.weightKg;
    return kg == null ? null : displayWeight(kg, this.units());
  });
  readonly savedHeight = computed(() => {
    const cm = this.profileService.profile()?.heightCm;
    return cm == null ? '—' : formatHeight(cm, this.units());
  });
  readonly savedAge = computed(() => this.profileService.profile()?.age);
  readonly bmiLabel = computed(() => {
    const profile = this.profileService.profile();
    return profile?.heightCm && profile.weightKg
      ? (profile.weightKg / (profile.heightCm / 100) ** 2).toFixed(1)
      : '—';
  });
  readonly goal = computed(() => {
    const goal = this.profileService.profile()?.goal;
    return goal === 'lose'
      ? { title: 'Lose weight', detail: 'A steady path toward your target.' }
      : goal === 'gain'
        ? { title: 'Build & grow', detail: 'Room to get a little stronger.' }
        : { title: 'Find your balance', detail: 'Keep building on what feels right.' };
  });
  readonly weeklyGoal = this.profileService.weeklyWorkoutGoal;
  readonly draft = computed(() => ({
    displayName: this.name().trim(),
    age: this.age(),
    heightCm: this.heightCm() == null ? null : Math.round(this.heightCm()!),
    weightKg: this.weightKg() == null ? null : Math.round(this.weightKg()! * 10) / 10,
    sex: this.sex(),
  }));
  readonly dirty = computed(
    () => this.loaded() && JSON.stringify(this.draft()) !== this.baseline(),
  );
  readonly valid = computed(
    () =>
      this.name().trim().length > 0 &&
      this.name().trim().length <= 80 &&
      this.age() != null &&
      Number.isInteger(this.age()) &&
      this.age()! >= 1 &&
      this.age()! <= 120 &&
      this.heightCm() != null &&
      Number.isFinite(this.heightCm()) &&
      this.heightCm()! >= 1 &&
      this.heightCm()! <= 300 &&
      this.weightKg() != null &&
      Number.isFinite(this.weightKg()) &&
      this.weightKg()! >= 1 &&
      this.weightKg()! <= 500,
  );

  ngOnInit(): void {
    this.loadProfile();
  }
  loadProfile(): void {
    this.loading.set(true);
    this.error.set('');
    this.profileService
      .load()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (profile) => {
          if (profile) {
            if (!this.dirty()) this.hydrate();
            this.loaded.set(true);
          } else this.error.set('Your profile couldn’t load. Please try again.');
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Your profile couldn’t load. Please try again.');
        },
      });
  }
  private hydrate(): void {
    const profile = this.profileService.profile();
    if (!profile) return;
    this.name.set(profile.displayName ?? '');
    this.age.set(profile.age);
    this.heightCm.set(profile.heightCm);
    this.weightKg.set(profile.weightKg);
    this.sex.set(profile.sex ?? '');
    this.baseline.set(JSON.stringify(this.draft()));
  }
  discard(): void {
    this.hydrate();
    this.error.set('');
    this.notice.set('Changes discarded.');
  }
  onWeightInput(value: number | null): void {
    this.weightKg.set(value == null ? null : toCanonicalWeight(value, this.units()));
  }
  onFeetInput(value: number | null): void {
    this.heightCm.set(value == null ? null : feetInchesToCm(value, this.inches() ?? 0));
  }
  onInchesInput(value: number | null): void {
    this.heightCm.set(value == null ? null : feetInchesToCm(this.feet() ?? 0, value));
  }
  save(): void {
    if (!this.valid() || !this.dirty() || this.saving() || this.uploading()) return;
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    this.profileService
      .patch(this.draft())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.hydrate();
          this.saving.set(false);
          this.notice.set('Your profile is up to date.');
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Your changes weren’t saved. Please try again.');
        },
      });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploading() || this.saving()) return;
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
    if (this.uploading() || this.saving()) return;
    this.uploading.set(true);
    this.profileService.patch({ avatar: '' }).subscribe({
      next: () => {
        this.uploading.set(false);
        this.message.success('Profile photo removed.');
      },
      error: () => {
        this.uploading.set(false);
        this.message.error('Could not remove the photo.');
      },
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
    const parts = (name || '')
      .trim()
      .split(/[\s@.]+/)
      .filter(Boolean);
    if (!parts.length) return '?';
    return parts.length === 1
      ? parts[0].charAt(0).toUpperCase()
      : (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}

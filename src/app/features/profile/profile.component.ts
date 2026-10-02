import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';

import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    NzLayoutModule,
    NzMenuModule,
    NzIconModule,
    AppMenuComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);
  private readonly message = inject(NzMessageService);

  readonly displayName = this.profileService.displayName;
  readonly avatar = computed(() => this.profileService.profile()?.avatar ?? '');
  readonly email = computed(() => this.profileService.profile()?.email ?? '');

  readonly uploading = signal(false);

  ngOnInit(): void {
    this.profileService.load().subscribe({
      error: () => this.message.error('Could not load your profile.'),
    });
  }

  /* ------------------------- avatar ------------------------- */

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
    this.authService.logout().subscribe();
  }
}

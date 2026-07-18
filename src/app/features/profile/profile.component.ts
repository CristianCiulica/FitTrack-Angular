import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzMessageService } from 'ng-zorro-antd/message';

import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { CommunityService } from '../../core/services/community.service';
import {
  CommunityAuthor,
  CommunityPerson,
  CommunityWorkout,
} from '../../core/models/workout.model';

type ProfileTab = 'posts' | 'followers' | 'following';

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
    NzSpinModule,
    NzPopconfirmModule,
    AppMenuComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly communityService = inject(CommunityService);
  private readonly authService = inject(AuthService);
  private readonly message = inject(NzMessageService);

  readonly displayName = this.profileService.displayName;
  readonly avatar = this.profileService.avatar;
  readonly email = computed(() => this.profileService.profile()?.email ?? '');

  readonly author = signal<CommunityAuthor | null>(null);
  readonly posts = signal<CommunityWorkout[]>([]);
  readonly followers = signal<CommunityPerson[]>([]);
  readonly following = signal<CommunityPerson[]>([]);
  readonly loading = signal(true);
  readonly uploading = signal(false);
  readonly tab = signal<ProfileTab>('posts');

  get myUid(): string {
    return this.authService.currentUserId;
  }

  ngOnInit(): void {
    this.profileService.load().subscribe();
    this.refresh();
  }

  private refresh(): void {
    this.loading.set(true);
    this.communityService.loadAuthor(this.myUid).subscribe({
      next: ({ author, posts }) => {
        this.author.set(author);
        this.posts.set(posts);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.communityService.loadMyFollowers().subscribe({
      next: (people) => this.followers.set(people),
      error: () => {},
    });
    this.communityService.loadMyFollowing().subscribe({
      next: (people) => this.following.set(people),
      error: () => {},
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

  /* ------------------------- social ------------------------- */

  toggleFollow(person: CommunityPerson): void {
    this.communityService.toggleFollow(person.uid).subscribe({
      next: ({ following }) => {
        this.followers.update((list) =>
          list.map((p) => (p.uid === person.uid ? { ...p, followedByMe: following } : p)),
        );
        if (following) {
          this.following.update((list) =>
            list.some((p) => p.uid === person.uid)
              ? list
              : [...list, { ...person, followedByMe: true }],
          );
        } else {
          this.following.update((list) => list.filter((p) => p.uid !== person.uid));
        }
      },
      error: () => this.message.error('Could not update follow'),
    });
  }

  deletePost(post: CommunityWorkout): void {
    this.communityService.deletePost(post.id).subscribe({
      next: () => {
        this.posts.update((list) => list.filter((p) => p.id !== post.id));
        const a = this.author();
        if (a) {
          this.author.set({
            ...a,
            postCount: a.postCount - 1,
            totalLikes: a.totalLikes - post.likeCount,
            totalSaves: a.totalSaves - post.saveCount,
          });
        }
        this.message.success('Post deleted');
      },
      error: () => this.message.error('Could not delete post'),
    });
  }

  /* ------------------------- helpere ------------------------- */

  initials(name: string): string {
    const parts = (name || '').trim().split(/[\s@.]+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.length === 1
      ? parts[0].charAt(0).toUpperCase()
      : (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

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

  primaryMuscle(post: CommunityWorkout): string {
    return post.exercises?.[0]?.muscleGroup ?? 'Full Body';
  }

  muscleTone(group: string): string {
    return this.muscleTones[group] ?? 'graphite';
  }

  logout(): void {
    this.authService.logout().subscribe();
  }
}

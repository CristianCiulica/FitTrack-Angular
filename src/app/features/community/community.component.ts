import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';

import { CommunityService } from '../../core/services/community.service';
import { WorkoutService } from '../../core/services/workout.service';
import { AuthService } from '../../core/services/auth.service';
import { CommunityWorkout, Workout } from '../../core/models/workout.model';
import { ProfileService } from '../../core/services/profile.service';
import { displayWeight } from '../../core/utils/units';
import { estimateSessionCalories, estimateSessionMinutes } from '../../core/utils/workout-calories';
import { WorkoutModalComponent } from '../../shared/components/workout-modal/workout-modal.component';

type FeedSort = 'recent' | 'popular';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzSpinModule,
    NzPopconfirmModule,
    WorkoutModalComponent,
  ],
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.scss'],
})
export class CommunityComponent implements OnInit {
  private readonly communityService = inject(CommunityService);
  private readonly workoutService = inject(WorkoutService);
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);
  private readonly message = inject(NzMessageService);

  readonly loading = this.communityService.loading;
  readonly units = this.profileService.units;

  readonly savingIds = signal<Set<string>>(new Set());
  readonly shareModalVisible = signal(false);
  readonly loadError = signal(false);

  // feed: sortare Recent / Popular
  readonly sort = signal<FeedSort>('recent');
  readonly feed = computed(() => {
    const list = [...this.communityService.communityWorkouts()];
    if (this.sort() === 'popular') {
      list.sort((a, b) => b.likeCount - a.likeCount || b.saveCount - a.saveCount);
    }
    return list;
  });

  // comentarii: care postari sunt extinse + draft-ul per postare
  readonly expandedComments = signal<Set<string>>(new Set());
  readonly commentDrafts = signal<Record<string, string>>({});
  // inima animata la dublu-tap, per postare
  readonly burstId = signal<string | null>(null);

  get myUid(): string {
    return this.authService.currentUserId;
  }

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

  /* ----------------------------- social ----------------------------- */

  toggleLike(cw: CommunityWorkout): void {
    this.communityService.toggleLike(cw.id).subscribe({
      error: () => this.message.error('Could not update like'),
    });
  }

  // dublu-tap pe "media" = like, ca pe Instagram (doar like, nu unlike)
  doubleTapLike(cw: CommunityWorkout): void {
    this.burstId.set(cw.id);
    setTimeout(() => this.burstId.set(null), 900);
    if (!cw.likedByMe) this.toggleLike(cw);
  }

  toggleComments(id: string): void {
    this.expandedComments.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  draftFor(id: string): string {
    return this.commentDrafts()[id] ?? '';
  }

  setDraft(id: string, text: string): void {
    this.commentDrafts.update((d) => ({ ...d, [id]: text }));
  }

  postComment(cw: CommunityWorkout): void {
    const text = this.draftFor(cw.id).trim();
    if (!text) return;
    this.communityService.addComment(cw.id, text).subscribe({
      next: () => {
        this.setDraft(cw.id, '');
        // dupa ce comentezi, vezi lista completa
        this.expandedComments.update((set) => new Set(set).add(cw.id));
      },
      error: () => this.message.error('Could not post comment'),
    });
  }

  deleteComment(cw: CommunityWorkout, commentId: string): void {
    this.communityService.deleteComment(cw.id, commentId).subscribe({
      error: () => this.message.error('Could not delete comment'),
    });
  }

  deletePost(cw: CommunityWorkout): void {
    this.communityService.deletePost(cw.id).subscribe({
      next: () => this.message.success('Post deleted'),
      error: () => this.message.error('Could not delete post'),
    });
  }

  canDeleteComment(cw: CommunityWorkout, authorId: string): boolean {
    return authorId === this.myUid || cw.authorId === this.myUid;
  }

  /* --------------------------- save & share --------------------------- */

  saveToMyWorkouts(cw: CommunityWorkout): void {
    this.savingIds.update((set) => new Set(set).add(cw.id));

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
        this.communityService.registerSave(cw.id).subscribe();
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

  /* ------- helpere de prezentare, in limbajul vizual al aplicatiei ------- */

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

  // timp relativ scurt, in stil Instagram: 5m, 2h, 3d, 2w
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

  // tonuri alternante pentru panoul "media" al postarii
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

  trackPost(_i: number, cw: CommunityWorkout): string {
    return cw.id;
  }
}

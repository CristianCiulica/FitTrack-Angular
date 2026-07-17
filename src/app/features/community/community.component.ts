import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';

import { CommunityService, FeedTab } from '../../core/services/community.service';
import { WorkoutService } from '../../core/services/workout.service';
import { AuthService } from '../../core/services/auth.service';
import {
  CommunityAuthor,
  CommunityWorkout,
  MUSCLE_GROUPS,
  MuscleGroup,
  Workout,
} from '../../core/models/workout.model';
import { ProfileService } from '../../core/services/profile.service';
import { displayWeight } from '../../core/utils/units';
import { estimateSessionCalories } from '../../core/utils/workout-calories';
import { WorkoutModalComponent } from '../../shared/components/workout-modal/workout-modal.component';

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
export class CommunityComponent implements OnInit, OnDestroy {
  private readonly communityService = inject(CommunityService);
  private readonly workoutService = inject(WorkoutService);
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);
  private readonly message = inject(NzMessageService);

  readonly muscleGroups = MUSCLE_GROUPS;
  readonly durations = [
    { label: 'Any length', value: null },
    { label: '< 20 min', value: 20 },
    { label: '< 40 min', value: 40 },
  ];

  readonly feed = this.communityService.communityWorkouts;
  readonly picks = this.communityService.picks;
  readonly loading = this.communityService.loading;
  readonly loadingMore = this.communityService.loadingMore;
  readonly hasMore = this.communityService.hasMore;
  readonly units = this.profileService.units;

  readonly savingIds = signal<Set<string>>(new Set());
  readonly shareModalVisible = signal(false);
  readonly loadError = signal(false);

  // filtrele feed-ului
  readonly tab = signal<FeedTab>('foryou');
  readonly muscle = signal<MuscleGroup | null>(null);
  readonly maxMinutes = signal<number | null>(null);
  readonly search = signal('');
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  // picks apar doar pe For You, fara filtre active
  readonly showPicks = computed(
    () =>
      this.tab() === 'foryou' &&
      !this.muscle() &&
      !this.maxMinutes() &&
      !this.search().trim() &&
      this.picks().length > 0,
  );

  // profilul de autor deschis peste feed
  readonly authorView = signal<{ author: CommunityAuthor; posts: CommunityWorkout[] } | null>(null);
  readonly authorLoading = signal(false);

  // comentarii extinse + draft-uri + inima de dublu-tap
  readonly expandedComments = signal<Set<string>>(new Set());
  readonly commentDrafts = signal<Record<string, string>>({});
  readonly burstId = signal<string | null>(null);

  // santinela apare abia dupa ce se incarca feed-ul, deci o urmarim ca signal
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('feedSentinel');
  private observer?: IntersectionObserver;

  constructor() {
    // infinite scroll: cand santinela devine vizibila, incarcam pagina urmatoare
    this.observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting) &&
          this.hasMore() &&
          !this.loading() &&
          !this.loadingMore()
        ) {
          this.communityService.loadMore().subscribe({ error: () => {} });
        }
      },
      { rootMargin: '400px' },
    );
    effect(() => {
      const el = this.sentinel()?.nativeElement;
      this.observer?.disconnect();
      if (el) this.observer?.observe(el);
    });
  }

  get myUid(): string {
    return this.authService.currentUserId;
  }

  ngOnInit(): void {
    this.reload();
    this.communityService.loadPicks().subscribe({ error: () => {} });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
  }

  /* ----------------------------- feed + filtre ----------------------------- */

  reload(): void {
    this.loadError.set(false);
    this.communityService
      .loadFeed({
        tab: this.tab(),
        muscle: this.muscle(),
        q: this.search(),
        maxMinutes: this.maxMinutes(),
      })
      .subscribe({ error: () => this.loadError.set(true) });
  }

  setTab(tab: FeedTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.reload();
  }

  setMuscle(muscle: MuscleGroup | null): void {
    this.muscle.set(this.muscle() === muscle ? null : muscle);
    this.reload();
  }

  setDuration(value: number | null): void {
    this.maxMinutes.set(value);
    this.reload();
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.reload(), 350);
  }

  /* ----------------------------- profil autor ----------------------------- */

  openAuthor(uid: string): void {
    this.authorLoading.set(true);
    this.communityService.loadAuthor(uid).subscribe({
      next: (data) => {
        this.authorView.set(data);
        this.authorLoading.set(false);
      },
      error: () => {
        this.authorLoading.set(false);
        this.message.error('Could not load profile');
      },
    });
  }

  closeAuthor(): void {
    this.authorView.set(null);
  }

  toggleFollow(uid: string): void {
    this.communityService.toggleFollow(uid).subscribe({
      next: ({ following, followers }) => {
        const view = this.authorView();
        if (view && view.author.uid === uid) {
          this.authorView.set({
            ...view,
            author: { ...view.author, followedByMe: following, followers },
            posts: view.posts.map((p) => ({ ...p, authorFollowedByMe: following })),
          });
        }
        // pe tab-ul Following, un unfollow trebuie sa scoata autorul din feed
        if (this.tab() === 'following' && !following) this.reload();
      },
      error: () => this.message.error('Could not update follow'),
    });
  }

  /* ----------------------------- social ----------------------------- */

  toggleLike(cw: CommunityWorkout): void {
    this.communityService.toggleLike(cw.id).subscribe({
      next: (updated) => this.patchAuthorView(updated),
      error: () => this.message.error('Could not update like'),
    });
  }

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
      next: (updated) => {
        this.setDraft(cw.id, '');
        this.expandedComments.update((set) => new Set(set).add(cw.id));
        this.patchAuthorView(updated);
      },
      error: () => this.message.error('Could not post comment'),
    });
  }

  deleteComment(cw: CommunityWorkout, commentId: string): void {
    this.communityService.deleteComment(cw.id, commentId).subscribe({
      next: (updated) => this.patchAuthorView(updated),
      error: () => this.message.error('Could not delete comment'),
    });
  }

  deletePost(cw: CommunityWorkout): void {
    this.communityService.deletePost(cw.id).subscribe({
      next: () => {
        this.message.success('Post deleted');
        const view = this.authorView();
        if (view) {
          this.authorView.set({
            ...view,
            author: { ...view.author, postCount: view.author.postCount - 1 },
            posts: view.posts.filter((p) => p.id !== cw.id),
          });
        }
      },
      error: () => this.message.error('Could not delete post'),
    });
  }

  canDeleteComment(cw: CommunityWorkout, authorId: string): boolean {
    return authorId === this.myUid || cw.authorId === this.myUid;
  }

  // postarile din vederea de profil trebuie sa reflecte like-urile/comentariile noi
  private patchAuthorView(updated: CommunityWorkout): void {
    const view = this.authorView();
    if (!view) return;
    this.authorView.set({
      ...view,
      posts: view.posts.map((p) => (p.id === updated.id ? updated : p)),
    });
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
        this.communityService.registerSave(cw.id).subscribe({
          next: (updated) => this.patchAuthorView(updated),
        });
        this.savingIds.update((set) => {
          const next = new Set(set);
          next.delete(cw.id);
          return next;
        });
      },
      error: () => {
        this.message.error('Failed to save workout');
        this.savingIds.update((set) => {
          const next = new Set(set);
          next.delete(cw.id);
          return next;
        });
      },
    });
  }

  onShareSave(workout: Partial<Workout>) {
    const exercises = workout.exercises || [];
    const description = (workout.notes || '').trim();
    // pragurile de calitate, validate si pe server
    if (exercises.length < 2) {
      this.message.error('Add at least 2 exercises before sharing.');
      return;
    }
    if (description.length < 10) {
      this.message.error('Add a short description (at least 10 characters) so others know what to expect.');
      return;
    }

    this.communityService
      .publishWorkout({ name: workout.name || 'My workout', description, exercises })
      .subscribe({
        next: () => {
          this.shareModalVisible.set(false);
          this.message.success('Workout shared to community!');
          this.reload();
          this.communityService.loadPicks().subscribe({ error: () => {} });
        },
        error: () => this.message.error('Failed to share workout'),
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

  // cast-uri pentru contextul ng-template (strict templates)
  asPost(value: unknown): CommunityWorkout {
    return value as CommunityWorkout;
  }

  asIndex(value: unknown): number {
    return value as number;
  }

  workoutKcal(cw: CommunityWorkout): number {
    return estimateSessionCalories(cw.exercises, this.profileService.weightKg());
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

  difficultyTone(difficulty: string): string {
    return { Beginner: 'green', Intermediate: 'blue', Advanced: 'pink' }[difficulty] ?? 'graphite';
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

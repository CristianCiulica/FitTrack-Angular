import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

const WORKOUT = '/start-workout';
const EASING = 'cubic-bezier(.16, 1, .3, 1)';

/** Expands the mobile + into the real route, keeping Router guards and browser history intact. */
@Injectable({ providedIn: 'root' })
export class WorkoutNavigationService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly window = this.document.defaultView;
  private busy = false;
  private generation = 0;
  private transition?: ViewTransition;
  private animations: Animation[] = [];
  private cover?: HTMLElement;
  private lockedShell?: { element: HTMLElement; inert: boolean };

  constructor() {
    // Capture before RouterLink handles the same click. Modified links retain native browser behaviour.
    this.document.addEventListener('click', this.onClick, true);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('click', this.onClick, true);
      this.clear();
    });
  }

  private readonly onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !this.window?.matchMedia('(max-width: 900px)').matches
    )
      return;
    const target = event.target;
    const link =
      target instanceof Element
        ? target.closest<HTMLAnchorElement>('.sidebar-menu a[href="/start-workout"]')
        : null;
    if (
      !link ||
      (link.target && link.target !== '_self') ||
      link.hasAttribute('download') ||
      link.getAttribute('aria-disabled') === 'true' ||
      link.closest('[inert]') ||
      !link.getClientRects().length
    )
      return;
    if (!this.busy && this.router.url.split(/[?#]/)[0] === WORKOUT) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!this.busy) void this.open(link);
  };

  private async open(link: HTMLAnchorElement) {
    this.busy = true;
    const token = ++this.generation;
    const w = this.window!;
    const rect = link.getBoundingClientRect();
    const x = rect.x + rect.width / 2,
      y = rect.y + rect.height / 2;
    const circle = w.getComputedStyle(link, '::before');
    const collapsed = `circle(${(parseFloat(circle.width) || 44) / 2}px at ${x}px ${y}px)`;
    const expanded = `circle(${Math.ceil(Math.hypot(Math.max(x, w.innerWidth - x), Math.max(y, w.innerHeight - y)))}px at ${x}px ${y}px)`;
    const blue = circle.backgroundColor || '#007aff';
    try {
      if (
        w.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !this.document.documentElement.animate
      ) {
        if (await this.navigate()) await this.focusHeading(token);
        return;
      }
      if (!this.document.startViewTransition) {
        await this.fallback(collapsed, expanded, blue, token);
        return;
      }
      this.document.documentElement.classList.add('workout-route-motion');
      const transition = this.document.startViewTransition(async () => {
        if (!(await this.navigate()) || token !== this.generation) {
          this.transition?.skipTransition();
          return;
        }
        // A named blue layer is captured separately from the new page. It fades like the assistant surface.
        this.createCover(blue, true);
      });
      this.transition = transition;
      void transition.updateCallbackDone.catch(() => {});
      void transition.finished.catch(() => {});
      await transition.ready;
      if (token !== this.generation || !this.cover) {
        transition.skipTransition();
        return;
      }
      this.animate(
        this.document.documentElement,
        [{ clipPath: collapsed }, { clipPath: expanded }],
        {
          duration: 1100,
          easing: EASING,
          fill: 'both',
          pseudoElement: '::view-transition-new(root)',
        },
      );
      this.animate(
        this.document.documentElement,
        [
          { clipPath: collapsed, opacity: 1 },
          { opacity: 0, offset: 0.45 },
          { clipPath: expanded, opacity: 0 },
        ],
        {
          duration: 1100,
          easing: EASING,
          fill: 'both',
          pseudoElement: '::view-transition-new(workout-launch-cover)',
        },
      );
      await transition.finished;
      this.cover?.remove();
      this.cover = undefined;
      await this.focusHeading(token);
    } catch {
      // A cancelled guard, interrupted transition, or route error must never leave a blocking surface.
    } finally {
      if (token === this.generation) this.clear();
    }
  }

  private async navigate(): Promise<boolean> {
    const result = await this.router.navigateByUrl(WORKOUT);
    return result && this.router.url.split(/[?#]/)[0] === WORKOUT;
  }
  private createCover(blue: string, named = false) {
    const cover = this.document.createElement('div');
    cover.className = 'workout-route-cover';
    cover.setAttribute('aria-hidden', 'true');
    cover.style.backgroundColor = blue;
    if (named) cover.style.viewTransitionName = 'workout-launch-cover';
    this.document.body.append(cover);
    this.cover = cover;
    return cover;
  }
  private animate(element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = element.animate(frames, options);
    this.animations.push(animation);
    void animation.finished.catch(() => {});
    return animation;
  }
  private async fallback(collapsed: string, expanded: string, blue: string, token: number) {
    const shell = this.document.querySelector<HTMLElement>('.route-shell');
    if (shell) {
      this.lockedShell = { element: shell, inert: shell.inert };
      shell.inert = true;
    }
    const cover = this.createCover(blue);
    await this.animate(cover, [{ clipPath: collapsed }, { clipPath: expanded }], {
      duration: 1100,
      easing: EASING,
      fill: 'both',
    }).finished;
    if (token !== this.generation || !(await this.navigate())) return;
    await this.animate(cover, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'both' })
      .finished;
    this.unlockShell();
    await this.focusHeading(token);
  }
  private async focusHeading(token: number) {
    await new Promise<void>((resolve) => this.window!.requestAnimationFrame(() => resolve()));
    if (token !== this.generation) return;
    const heading =
      this.document.querySelector<HTMLElement>('.workout-live h1') ??
      this.document.querySelector<HTMLElement>('.library-hero h1');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }
  private unlockShell() {
    if (this.lockedShell) this.lockedShell.element.inert = this.lockedShell.inert;
    this.lockedShell = undefined;
  }
  private clear() {
    ++this.generation;
    this.transition?.skipTransition();
    this.transition = undefined;
    this.animations.forEach((animation) => animation.cancel());
    this.animations = [];
    this.cover?.remove();
    this.cover = undefined;
    this.unlockShell();
    this.document.documentElement.classList.remove('workout-route-motion');
    this.busy = false;
  }
}

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { WorkoutNavigationService } from './workout-navigation.service';

describe('Mobile dock reveal navigation', () => {
  let router: { url: string; navigateByUrl: ReturnType<typeof vi.fn> };
  let node: HTMLElement;
  let link: HTMLAnchorElement;
  let mobile: boolean;
  let reduced: boolean;
  let transitionDescriptor: PropertyDescriptor | undefined;
  const tick = async () => {
    for (let i = 0; i < 15; i++) await Promise.resolve();
  };
  beforeEach(() => {
    mobile = true;
    reduced = true;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width') ? mobile : reduced,
    }));
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      width: '44px',
      backgroundColor: 'rgb(0, 122, 255)',
      getPropertyValue: () => '#007aff',
    } as unknown as CSSStyleDeclaration);
    router = {
      url: '/dashboard',
      navigateByUrl: vi.fn(async (destination: string) => {
        router.url = destination;
        return true;
      }),
    };
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });
    TestBed.inject(WorkoutNavigationService);
    node = document.createElement('div');
    node.className = 'route-shell';
    node.innerHTML =
      '<ul class="sidebar-menu"><li><a href="/start-workout"><span>+</span></a></li></ul><div class="library-hero"><h1>Your next 30 days</h1></div>';
    document.body.append(node);
    link = node.querySelector('a')!;
    vi.spyOn(link, 'getClientRects').mockReturnValue([{}] as any);
    vi.spyOn(link, 'getBoundingClientRect').mockReturnValue({
      x: 157.6,
      y: 780,
      width: 74.8,
      height: 64,
    } as DOMRect);
    transitionDescriptor = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    node.remove();
    if (transitionDescriptor)
      Object.defineProperty(document, 'startViewTransition', transitionDescriptor);
    else delete (document as any).startViewTransition;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  function click(options: MouseEventInit = {}) {
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...options,
    });
    link.querySelector('span')!.dispatchEvent(event);
    return event;
  }
  it('captures the + before RouterLink, navigates once and focuses the destination with reduced motion', async () => {
    const targetHandler = vi.fn();
    link.addEventListener('click', targetHandler);
    expect(click().defaultPrevented).toBe(true);
    await tick();
    expect(router.navigateByUrl).toHaveBeenCalledExactlyOnceWith('/start-workout');
    expect(targetHandler).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(node.querySelector('h1'));
    expect(document.querySelector('.workout-route-cover')).toBeNull();
    expect(document.documentElement.classList.contains('workout-route-motion')).toBe(false);
  });
  it.each(['/dashboard', '/running', '/bmi'])(
    'reveals %s from its dock icon and keeps route history',
    async (destination) => {
      router.url = '/start-workout';
      link.href = destination;
      const targetHandler = vi.fn();
      link.addEventListener('click', targetHandler);
      expect(click().defaultPrevented).toBe(true);
      await tick();
      expect(router.navigateByUrl).toHaveBeenCalledExactlyOnceWith(destination);
      expect(targetHandler).not.toHaveBeenCalled();
      expect(document.querySelector('.workout-route-cover')).toBeNull();
    },
  );
  it('leaves History navigation immediate', () => {
    link.href = '/workouts';
    expect(click().defaultPrevented).toBe(false);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
  it('leaves desktop links, modified clicks, active Workout links and locked sessions alone', () => {
    for (const options of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ])
      expect(click(options).defaultPrevented).toBe(false);
    mobile = false;
    expect(click().defaultPrevented).toBe(false);
    mobile = true;
    router.url = '/start-workout?plan=one';
    expect(click().defaultPrevented).toBe(false);
    router.url = '/dashboard';
    link.setAttribute('aria-disabled', 'true');
    expect(click().defaultPrevented).toBe(false);
    link.removeAttribute('aria-disabled');
    node.setAttribute('inert', '');
    expect(click().defaultPrevented).toBe(false);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
  it('suppresses repeat taps while guards resolve and clears cancelled navigation', async () => {
    let resolve!: (result: boolean) => void;
    router.navigateByUrl.mockImplementation(() => new Promise<boolean>((r) => (resolve = r)));
    click();
    click();
    expect(router.navigateByUrl).toHaveBeenCalledTimes(1);
    resolve(false);
    await tick();
    click();
    expect(router.navigateByUrl).toHaveBeenCalledTimes(2);
    resolve(false);
    await tick();
    expect(document.querySelector('.workout-route-cover')).toBeNull();
  });
  it('reveals the actual route from the blue 44px circle for 1600ms and removes temporary layers', async () => {
    reduced = false;
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel }));
    Object.defineProperty(document.documentElement, 'animate', {
      configurable: true,
      value: animate,
    });
    const skip = vi.fn();
    const start = vi.fn((update: () => Promise<void>) => {
      const done = Promise.resolve().then(update);
      return { ready: done, finished: done, updateCallbackDone: done, skipTransition: skip };
    });
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start });
    click();
    await tick();
    expect(start).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[0]).toEqual([
      [
        { clipPath: 'circle(22px at 195px 812px)' },
        { clipPath: expect.stringMatching(/^circle\(/) },
      ],
      expect.objectContaining({ duration: 1600, pseudoElement: '::view-transition-new(root)' }),
    ]);
    expect(document.querySelector('.workout-route-cover')).toBeNull();
    expect(document.documentElement.classList.contains('workout-route-motion')).toBe(false);
    delete (document.documentElement as any).animate;
  });
});

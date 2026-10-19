/** Native dialog reveal anchored to the launcher, with interruptible reverse and reduced-motion support. */
export class CircularDialogMotion {
  private surface?: Animation;
  private content?: Animation;
  private token = 0;
  closing = false;
  constructor(
    private dialog: HTMLDialogElement,
    private launcher: HTMLButtonElement,
    private body: HTMLElement,
  ) {}
  private geometry() {
    const r = this.launcher.getBoundingClientRect(),
      x = r.x + r.width / 2,
      y = r.y + r.height / 2;
    return {
      collapsed: `circle(${r.width / 2}px at ${x}px ${y}px)`,
      expanded: `circle(${Math.ceil(Math.hypot(Math.max(x, this.dialog.clientWidth - x), Math.max(y, this.dialog.clientHeight - y)))}px at ${x}px ${y}px)`,
      blue: getComputedStyle(this.launcher).backgroundColor,
    };
  }
  private cancel() {
    this.surface?.cancel();
    this.content?.cancel();
    this.surface = undefined;
    this.content = undefined;
  }
  private reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || !this.dialog.animate;
  }
  async open(): Promise<void> {
    if (this.dialog.open) return;
    const token = ++this.token;
    this.cancel();
    this.closing = false;
    this.dialog.showModal();
    if (this.reduced()) return;
    const g = this.geometry(),
      background = getComputedStyle(this.dialog).backgroundColor;
    this.surface = this.dialog.animate(
      [
        { clipPath: g.collapsed, backgroundColor: g.blue },
        { backgroundColor: background, offset: 0.45 },
        { clipPath: g.expanded, backgroundColor: background },
      ],
      { duration: 1100, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' },
    );
    this.content = this.body.animate(
      [
        { opacity: 0, transform: 'translateY(18px) scale(.985)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 600, delay: 220, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' },
    );
    void this.content.finished.catch(() => {});
    try {
      await this.surface.finished;
      if (token === this.token) this.cancel();
    } catch {
      /* Interrupted by close or navigation. */
    }
  }
  async close(): Promise<void> {
    if (!this.dialog.open || this.closing) return;
    this.closing = true;
    const token = ++this.token,
      g = this.geometry(),
      current = getComputedStyle(this.dialog);
    const clip = current.clipPath === 'none' ? g.expanded : current.clipPath,
      background = current.backgroundColor,
      opacity = getComputedStyle(this.body).opacity;
    this.cancel();
    if (!this.reduced()) {
      this.content = this.body.animate(
        [
          { opacity, transform: 'none' },
          { opacity: 0, transform: 'translateY(12px) scale(.985)' },
        ],
        { duration: 240, fill: 'both' },
      );
      void this.content.finished.catch(() => {});
      this.surface = this.dialog.animate(
        [
          { clipPath: clip, backgroundColor: background },
          { backgroundColor: background, offset: 0.55 },
          { clipPath: g.collapsed, backgroundColor: g.blue },
        ],
        { duration: 750, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'both' },
      );
      try {
        await this.surface.finished;
      } catch {
        return;
      }
    }
    if (token !== this.token) return;
    this.cancel();
    this.dialog.close();
    this.closing = false;
    this.launcher.focus({ preventScroll: true });
  }
  destroy() {
    ++this.token;
    this.cancel();
    if (this.dialog.open) this.dialog.close();
  }
}

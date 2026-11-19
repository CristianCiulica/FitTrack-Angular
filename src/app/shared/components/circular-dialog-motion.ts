/** Native dialog transition anchored to the launcher, with interruptible reverse and reduced-motion support. */
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
    const button = this.launcher.getBoundingClientRect();
    const panel = this.dialog.getBoundingClientRect();
    const style = getComputedStyle(this.launcher);
    const inset = [button.top - panel.top, panel.right - button.right, panel.bottom - button.bottom, button.left - panel.left];
    return {
      collapsed: `inset(${inset.map(value => value + 'px').join(' ')} round ${style.borderRadius})`,
      expanded: 'inset(0px 0px 0px 0px round 0px)',
      launcherColor: style.backgroundColor,
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
        { clipPath: g.collapsed, backgroundColor: g.launcherColor },
        { backgroundColor: background, offset: 0.45 },
        { clipPath: g.expanded, backgroundColor: background },
      ],
      { duration: 430, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' },
    );
    this.content = this.body.animate(
      [
        { opacity: 0, transform: 'translateY(18px) scale(.985)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 280, delay: 75, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' },
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
        { duration: 150, fill: 'both' },
      );
      void this.content.finished.catch(() => {});
      this.surface = this.dialog.animate(
        [
          { clipPath: clip, backgroundColor: background },
          { backgroundColor: background, offset: 0.55 },
          { clipPath: g.collapsed, backgroundColor: g.launcherColor },
        ],
        { duration: 360, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'both' },
      );
      try {
        await this.surface.finished;
      } catch {
        return;
      }
    }
    if (token !== this.token) return;
    this.dialog.close();
    this.cancel();
    this.closing = false;
    this.launcher.focus({ preventScroll: true });
  }
  destroy() {
    ++this.token;
    this.cancel();
    if (this.dialog.open) this.dialog.close();
  }
}

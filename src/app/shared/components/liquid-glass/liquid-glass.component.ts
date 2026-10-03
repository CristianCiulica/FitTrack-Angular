import { supportsGlassRefraction } from '../../../core/utils/glass-support';
import { afterNextRender, Component, DestroyRef, ElementRef, inject, NgZone } from '@angular/core';
import { glassLensPixels } from '../../../core/utils/glass-lens';

@Component({
  selector: 'app-liquid-glass',
  standalone: true,
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id="ft-dock-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
          <feImage result="lens" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" />
          <feDisplacementMap in="SourceGraphic" in2="lens" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  `,
  styles: [':host { position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none; }'],
})
export class LiquidGlassComponent {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.connect()));
  }

  private connect(): void {
    const mobile = window.matchMedia('(max-width: 600px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    // WebKit/Firefox do not render SVG displacement in backdrop-filter reliably.
    // They keep the CSS optical material, including blur and specular edges.
    const supportsLens = supportsGlassRefraction();
    const filterImage = this.element.nativeElement.querySelector('feImage');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    let dock: HTMLElement | null = null;
    let frame = 0;
    let previousSize = '';
    let pointerFrame = 0;
    let pointerX = 0;

    const update = () => {
      frame = 0;
      if (!dock || !mobile.matches || !supportsLens || !context || !filterImage) return;
      const width = Math.round(dock.clientWidth);
      const height = Math.round(dock.clientHeight);
      if (!width || !height) return;
      const size = `${width}:${height}`;
      if (size !== previousSize) {
        canvas.width = width;
        canvas.height = height;
        const data = context.createImageData(width, height);
        data.data.set(glassLensPixels(width, height));
        context.putImageData(data, 0, 0);
        filterImage.setAttribute('href', canvas.toDataURL());
        previousSize = size;
      }
      dock.classList.add('has-glass-lens');
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const move = (event: PointerEvent) => {
      if (!dock || reduced.matches) return;
      pointerX = event.clientX;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!dock) return;
        const rect = dock.getBoundingClientRect();
        dock.style.setProperty('--glass-light-x', `${Math.round((pointerX - rect.left) / rect.width * 100)}%`);
      });
    };
    const reset = () => { cancelAnimationFrame(pointerFrame); pointerFrame = 0; dock?.style.removeProperty('--glass-light-x'); };
    const resize = new ResizeObserver(schedule);
    const discover = () => {
      const next = document.querySelector<HTMLElement>('.app-layout > .sidebar');
      if (next === dock) return;
      if (dock) {
        resize.unobserve(dock);
        dock.removeEventListener('pointermove', move);
        dock.removeEventListener('pointerleave', reset);
      }
      dock = next;
      if (dock) {
        resize.observe(dock);
        dock.addEventListener('pointermove', move, { passive: true });
        dock.addEventListener('pointerleave', reset, { passive: true });
        schedule();
      }
    };
    const observer = new MutationObserver(discover);
    observer.observe(document.querySelector('.route-shell') ?? document.body, { childList: true });
    mobile.addEventListener('change', schedule);
    discover();
    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pointerFrame);
      mobile.removeEventListener('change', schedule);
      dock?.removeEventListener('pointermove', move);
      dock?.removeEventListener('pointerleave', reset);
      dock?.classList.remove('has-glass-lens');
    });
  }
}

import { supportsGlassRefraction } from '../../../core/utils/glass-support';
import { afterNextRender, DestroyRef, Directive, ElementRef, inject, NgZone } from '@angular/core';
import { glassLensPixels } from '../../../core/utils/glass-lens';

let nextLens = 0;

/** A separate, size-matched optical lens for each rounded glass panel. */
@Directive({ selector: '[appLiquidGlass]', standalone: true, host: { class: 'liquid-panel' } })
export class LiquidGlassDirective {
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly destroy = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.connect()));
  }

  private connect(): void {
    const defs = document.querySelector('app-liquid-glass svg defs');
    if (!defs || !supportsGlassRefraction()) return;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    const ns = 'http://www.w3.org/2000/svg';
    const id = `ft-panel-lens-${nextLens++}`;
    const filter = document.createElementNS(ns, 'filter');
    for (const [name, value] of Object.entries({ id, x: '0', y: '0', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' })) filter.setAttribute(name, value);
    const image = document.createElementNS(ns, 'feImage');
    for (const [name, value] of Object.entries({ result: 'lens', preserveAspectRatio: 'none', x: '0', y: '0', width: '100%', height: '100%' })) image.setAttribute(name, value);
    const displacement = document.createElementNS(ns, 'feDisplacementMap');
    for (const [name, value] of Object.entries({ in: 'SourceGraphic', in2: 'lens', scale: '22', xChannelSelector: 'R', yChannelSelector: 'G' })) displacement.setAttribute(name, value);
    filter.append(image, displacement);
    defs.append(filter);
    let frame = 0;
    let lastSize = '';
    const update = () => {
      frame = 0;
      const width = Math.round(this.host.clientWidth);
      const height = Math.round(this.host.clientHeight);
      const radius = parseFloat(getComputedStyle(this.host).borderTopLeftRadius) || 32;
      const size = `${width}:${height}:${radius}`;
      if (!width || !height || size === lastSize) return;
      canvas.width = width;
      canvas.height = height;
      const pixels = context.createImageData(width, height);
      pixels.data.set(glassLensPixels(width, height, radius));
      context.putImageData(pixels, 0, 0);
      image.setAttribute('href', canvas.toDataURL());
      this.host.style.setProperty('--panel-lens', `url('#${id}')`);
      this.host.classList.add('has-panel-lens');
      lastSize = size;
    };
    const observer = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(update);
    });
    observer.observe(this.host);
    update();
    this.destroy.onDestroy(() => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      filter.remove();
      this.host.style.removeProperty('--panel-lens');
      this.host.classList.remove('has-panel-lens');
    });
  }
}

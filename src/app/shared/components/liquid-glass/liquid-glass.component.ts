import { Component } from '@angular/core';

// Feature panels append size-specific SVG filters to this shared definition list.
@Component({
  selector: 'app-liquid-glass',
  standalone: true,
  template: '<svg width="0" height="0" aria-hidden="true" focusable="false"><defs /></svg>',
  styles: [':host { position: absolute; width: 0; height: 0; pointer-events: none; }'],
})
export class LiquidGlassComponent {}

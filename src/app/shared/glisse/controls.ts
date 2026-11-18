import { Component, ElementRef, afterRenderEffect, inject, input, output, viewChild, DestroyRef } from '@angular/core';
import { createRoot } from 'react-dom/client';
import { createElement as h } from 'react';
import { Router } from '@angular/router';
import { FT_ICONS } from './icons';
import { Button, Slider, TabBar } from 'glisse';

function mount(element: HTMLElement) {
  const root = createRoot(element);
  inject(DestroyRef).onDestroy(() => root.unmount());
  return root;
}

@Component({
  selector: 'ft-slider',
  template: '',
  styles: [':host { display:block; width:100% }'],
})
export class FitSlider {
  readonly value = input.required<number>();
  readonly max = input.required<number>();
  readonly label = input.required<string>();
  readonly inputId = input<string>();
  readonly changed = output<number>();
  private readonly root = mount(inject(ElementRef).nativeElement);
  constructor() {
    afterRenderEffect(() => this.root.render(h(Slider, {
      value: this.value(), min: 0.1, max: this.max(), step: 0.1, id: this.inputId(),
      'aria-label': this.label(), onValueChange: value => this.changed.emit(value),
    })));
  }
}

@Component({
  selector: 'ft-action',
  template: '<span hidden><span #content><ng-content /></span></span><span #target></span>',
  styles: [':host {display:inline-block} :host .lg-button {width:100%}'],
})
export class FitAction {
  readonly activated = output<void>();
  readonly disabled = input(false);
  readonly busy = input(false);
  readonly label = input<string>();
  readonly kind = input<'button' | 'submit'>('button');
  readonly destructive = input(false);
  private readonly target = viewChild.required<ElementRef>('target');
  private readonly content = viewChild.required<ElementRef>('content');
  constructor() {
    const destroy = inject(DestroyRef);
    let root: ReturnType<typeof createRoot> | undefined;
    destroy.onDestroy(() => root?.unmount());
    afterRenderEffect(() => {
      root ??= createRoot(this.target().nativeElement);
      const content = this.content().nativeElement;
      root.render(h(Button, {
        type: this.kind(), disabled: this.disabled() || this.busy(),
        destructive: this.destructive(), 'aria-label': this.label(), 'aria-busy': this.busy(), onClick: () => this.activated.emit(),
      }, h('span', {ref: (el: HTMLSpanElement | null) => { if (el) el.append(content); }})));
    });
  }
}

const tabs = [
  ['/dashboard', 'Home', 'ft:home'], ['/workouts', 'History', 'ft:history'],
  ['/start-workout', 'Workout', 'ft:workout'], ['/running', 'Run', 'ft:run'],
  ['/bmi', 'Nutrition', 'ft:nutrition'],
].map(([value, label, icon]) => ({
  value, label, icon: h('span', {dangerouslySetInnerHTML: {__html: FT_ICONS[icon]}}),
}));

@Component({selector: 'ft-tab-bar', template: ''})
export class FitTabBar {
  readonly locked = input(false);
  private readonly router = inject(Router);
  private readonly root = mount(inject(ElementRef).nativeElement);
  constructor() {
    afterRenderEffect(() => {
      const url = this.router.lastSuccessfulNavigation?.()?.finalUrl?.toString() ?? this.router.url;
      const path = url?.split(/[?#]/)[0];
      this.root.render(h(TabBar, {
        items: tabs, value: tabs.find(item => item.value === path)?.value ?? null,
        'aria-label': 'Main navigation', 'aria-disabled': this.locked(),
        onValueChange: value => { if (!this.locked()) void this.router.navigateByUrl(value); },
      }));
    });
  }
}

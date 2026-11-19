import { Component, ElementRef, afterRenderEffect, inject, input, output, viewChild, DestroyRef } from '@angular/core';
import { createRoot } from 'react-dom/client';
import { createElement as h, useState } from 'react';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { FT_ICONS } from './icons';
import { Button, Slider, TabBar } from 'glisse';

function mount(element: HTMLElement) {
  const root = createRoot(element);
  inject(DestroyRef).onDestroy(() => root.unmount());
  return root;
}

interface PaceProps {
  value: number;
  max: number;
  label: string;
  valueText: string;
  id?: string;
  change: (value: number) => void;
}

function PaceSlider({value, max, label, valueText, id, change}: PaceProps) {
  // Keep native input events in order while Angular renders the updated training goal.
  const [editing, setEditing] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const release = () => {
    setDragging(false);
    setEditing(current => current === null ? null : Math.round(current * 100) / 100);
  };
  return h(Slider, {
    id, min: 0.1, max, value: editing ?? value, step: dragging ? 0.001 : 0.01,
    'aria-label': label, 'aria-valuetext': valueText,
    onPointerDown: event => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    },
    onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release,
    onBlur: () => { setDragging(false); setEditing(null); },
    onValueChange: next => {
      setEditing(next);
      change(Math.round(next * 100) / 100);
    },
  });
}

@Component({
  selector: 'ft-slider',
  template: '',
  styles: [':host { display:block; width:100%; padding:2px 0; --lg-rail:color-mix(in srgb, var(--ink) 15%, transparent); --lg-fill:var(--accent) }'],
})
export class FitSlider {
  readonly value = input.required<number>();
  readonly max = input.required<number>();
  readonly label = input.required<string>();
  readonly inputId = input<string>();
  readonly valueText = input.required<string>();
  readonly changed = output<number>();
  private readonly root = mount(inject(ElementRef).nativeElement);
  constructor() {
    afterRenderEffect(() => this.root.render(h(PaceSlider, {
      value: this.value(), max: this.max(), id: this.inputId(),
      label: this.label(), valueText: this.valueText(), change: value => this.changed.emit(value),
    })));
  }
}

@Component({
  selector: 'ft-action',
  template: '<span hidden><span #content><ng-content /></span></span><span #target></span>',
  styles: [':host {display:inline-block} :host .lg-button {width:100%}'],
})
export class FitAction {
  readonly dialogId = input<string>();
  readonly expanded = input<boolean>();
  get button(): HTMLButtonElement {
    return this.target().nativeElement.querySelector('button')!;
  }
  readonly activated = output<void>();
  readonly disabled = input(false);
  readonly busy = input(false);
  readonly label = input<string>();
  readonly kind = input<'button' | 'submit'>('button');
  readonly destructive = input(false);
  readonly variant = input<'glass' | 'filled'>('glass');
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
        'aria-haspopup': this.dialogId() ? 'dialog' : undefined,
        'aria-controls': this.dialogId(), 'aria-expanded': this.expanded(),
        variant: this.variant(), destructive: this.destructive(), 'aria-label': this.label(), 'aria-busy': this.busy(), onClick: () => this.activated.emit(),
      }, h('span', {ref: (el: HTMLSpanElement | null) => { if (el) el.append(content); }})));
    });
  }
}

const primaryNavigation = [
  ['/dashboard', 'Home', 'ft:home'], ['/workouts', 'History', 'ft:history'],
  ['/start-workout', 'Workout', 'ft:workout'], ['/running', 'Run', 'ft:run'],
  ['/bmi', 'Nutrition', 'ft:nutrition'],
];
const tabs = primaryNavigation.map(([value, label, icon]) => ({
  value, label, icon: h('span', {dangerouslySetInnerHTML: {__html: FT_ICONS[icon]}}),
}));

@Component({selector: 'ft-tab-bar', template: ''})
export class FitTabBar {
  readonly desktop = input(false);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly links = tabs.map(item => ({ ...item, href: this.location.prepareExternalUrl(item.value) }));
  private readonly desktopLinks = [...this.links, {
    value: '/progress', href: this.location.prepareExternalUrl('/progress'), label: 'Progress'
  }].map(({ value, href, label }) => ({ value, href, label }));
  private readonly root = mount(inject(ElementRef).nativeElement);
  constructor() {
    afterRenderEffect(() => {
      const links = this.desktop() ? this.desktopLinks : this.links;
      const url = this.router.lastSuccessfulNavigation?.()?.finalUrl?.toString() ?? this.router.url;
      const path = url?.split(/[?#]/)[0];
      this.root.render(h(TabBar, {
        items: links, value: links.find(item => item.value === path)?.value ?? null,
        'aria-label': 'Main navigation',
        onClick: event => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
          const item = links.find(link => link.href === anchor?.getAttribute('href'));
          if (!item) return;
          event.preventDefault();
          void this.router.navigateByUrl(item.value);
        },
      }));
    });
  }
}

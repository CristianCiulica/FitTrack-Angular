import { Component, ElementRef, afterRenderEffect, inject, input, output, viewChild, DestroyRef, NgZone } from '@angular/core';
import { createRoot } from 'react-dom/client';
import { createElement as h, useState } from 'react';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { FT_ICONS } from './icons';
import { Button, Slider, TabBar } from 'glisse';
import type { ButtonProps } from 'glisse';
import { ThemeService } from '../../core/services/theme.service';
import { BlurTabBar } from './blur-tab-bar';

function mount(element: HTMLElement) {
  const zone = inject(NgZone);
  // Glisse schedules frame loops and pointer listeners. Keep them outside change detection.
  const root = zone.runOutsideAngular(() => createRoot(element));
  inject(DestroyRef).onDestroy(() => zone.runOutsideAngular(() => root.unmount()));
  return {
    render: (node: Parameters<typeof root.render>[0]) => zone.runOutsideAngular(() => root.render(node)),
  };
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
  private readonly zone = inject(NgZone);
  private readonly appearance = inject(ThemeService);
  private readonly root = mount(inject(ElementRef).nativeElement);
  constructor() {
    afterRenderEffect(() => {
      const value = this.value(), max = this.max(), id = this.inputId();
      const label = this.label(), valueText = this.valueText();
      const change = (next: number) => this.zone.run(() => this.changed.emit(next));
      this.root.render(this.appearance.effectStyle() === 'blur'
        ? h('input', { className: 'ft-blur-range', id, type: 'range', min: 0.1, max, step: 0.01, value,
            'aria-label': label, 'aria-valuetext': valueText, onChange: event => change(event.currentTarget.valueAsNumber) })
        : h(PaceSlider, { value, max, id, label, valueText, change }));
    });
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
  private readonly zone = inject(NgZone);
  private readonly appearance = inject(ThemeService);
  constructor() {
    const zone = this.zone;
    const destroy = inject(DestroyRef);
    let root: ReturnType<typeof createRoot> | undefined;
    destroy.onDestroy(() => zone.runOutsideAngular(() => root?.unmount()));
    afterRenderEffect(() => {
      root ??= zone.runOutsideAngular(() => createRoot(this.target().nativeElement));
      const content = this.content().nativeElement;
      const variant = this.variant(), destructive = this.destructive();
      const props: ButtonProps = {
        type: this.kind(), disabled: this.disabled() || this.busy(),
        'aria-haspopup': this.dialogId() ? 'dialog' : undefined,
        'aria-controls': this.dialogId(), 'aria-expanded': this.expanded(),
        'aria-label': this.label(), 'aria-busy': this.busy(), onClick: () => zone.run(() => this.activated.emit()),
      };
      const label = h('span', {ref: (el: HTMLSpanElement | null) => { if (el) el.append(content); }});
      const button = this.appearance.effectStyle() === 'blur'
        ? h('button', { ...props, className: 'lg-button ft-blur-button', 'data-variant': variant,
            'data-destructive': destructive ? '' : undefined }, label)
        : h(Button, { ...props, variant, destructive }, label);
      zone.runOutsideAngular(() => root!.render(button));
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
  private readonly zone = inject(NgZone);
  private readonly appearance = inject(ThemeService);
  private readonly root = mount(inject(ElementRef).nativeElement);
  constructor() {
    afterRenderEffect(() => {
      const links = this.desktop() ? this.desktopLinks : this.links;
      const url = this.router.lastSuccessfulNavigation?.()?.finalUrl?.toString() ?? this.router.url;
      const path = url?.split(/[?#]/)[0];
      const selected = links.find(item => item.value === path)?.value ?? null;
      if (this.appearance.effectStyle() === 'blur') {
        this.root.render(h(BlurTabBar, { links, selected, desktop: this.desktop(),
          navigate: path => this.zone.run(() => void this.router.navigateByUrl(path)) }));
        return;
      }
      this.root.render(h(TabBar, {
        items: links, value: selected,
        'aria-label': 'Main navigation',
        onClick: event => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
          const item = links.find(link => link.href === anchor?.getAttribute('href'));
          if (!item) return;
          event.preventDefault();
          this.zone.run(() => void this.router.navigateByUrl(item.value));
        },
      }));
    });
  }
}

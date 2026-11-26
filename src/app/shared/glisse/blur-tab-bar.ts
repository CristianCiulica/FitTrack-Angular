import { createElement as h, useRef, type ReactNode } from 'react';

type Link = { value: string; href: string; label: string; icon?: ReactNode };

export function BlurTabBar({ links, selected, desktop, navigate }: {
  links: Link[];
  selected: string | null;
  desktop: boolean;
  navigate: (path: string) => void;
}) {
  const startX = useRef<number | null>(null);
  const swiped = useRef(false);
  return h('nav', {
    className: 'lg-tab-bar ft-blur-tabs', 'aria-label': 'Main navigation', 'data-icons': desktop ? undefined : '',
    onPointerDown: event => {
      if (!event.isPrimary) return;
      startX.current = event.clientX;
      swiped.current = false;
    },
    onPointerCancel: () => { startX.current = null; },
    onPointerUp: event => {
      const start = startX.current;
      startX.current = null;
      if (!event.isPrimary || start === null || Math.abs(event.clientX - start) < 12) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('a');
      const path = target?.dataset['path'];
      if (path && event.currentTarget.contains(target)) {
        swiped.current = true;
        navigate(path);
      }
    },
  }, links.map(item => h('a', {
    key: item.value, className: 'lg-tab', href: item.href, 'data-path': item.value,
    'aria-current': item.value === selected ? 'page' : undefined,
    onClick: event => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      if (!swiped.current || event.detail === 0) navigate(item.value);
      swiped.current = false;
    },
  }, desktop ? null : h('span', { className: 'lg-tab-icon', 'aria-hidden': true }, item.icon),
  h('span', { className: desktop ? 'lg-tab-text' : 'lg-tab-label' }, item.label))));
}

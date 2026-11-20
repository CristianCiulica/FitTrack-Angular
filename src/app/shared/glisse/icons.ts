// iconite custom, stil SF Symbols, pentru navigarea principala.
// fill="none" trebuie pus pe fiecare forma: ng-zorro suprascrie fill-ul de pe radacina svg.
const FT_ICON_ATTRS = 'viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const FT_SHAPE = 'fill="none"';
export const FT_ICONS: Record<string, string> = {
  'ft:home': `<svg ${FT_ICON_ATTRS}><path ${FT_SHAPE} d="M3.5 10.6 12 3.6l8.5 7"/><path ${FT_SHAPE} d="M5.5 9.4V19a1.6 1.6 0 0 0 1.6 1.6h9.8A1.6 1.6 0 0 0 18.5 19V9.4"/><path ${FT_SHAPE} d="M9.7 20.6v-4.8a2.3 2.3 0 0 1 4.6 0v4.8"/></svg>`,
  'ft:history': `<svg ${FT_ICON_ATTRS}><circle ${FT_SHAPE} cx="12" cy="12" r="8.3"/><path ${FT_SHAPE} d="M12 7.6V12l3.1 1.8"/></svg>`,
  'ft:workout': `<svg ${FT_ICON_ATTRS}><path ${FT_SHAPE} d="M2.8 10.6v2.8"/><path ${FT_SHAPE} d="M6 8.2v7.6"/><path ${FT_SHAPE} d="M18 8.2v7.6"/><path ${FT_SHAPE} d="M21.2 10.6v2.8"/><path ${FT_SHAPE} d="M6 12h12"/></svg>`,
  'ft:run': `<svg ${FT_ICON_ATTRS}><circle ${FT_SHAPE} cx="5.4" cy="18.2" r="1.8"/><path ${FT_SHAPE} d="M7.2 18.2h6.6a4.1 4.1 0 0 0 0-8.2h-1.9"/><path ${FT_SHAPE} d="M18 3.4a3.3 3.3 0 0 1 3.3 3.3c0 2.5-3.3 5.5-3.3 5.5s-3.3-3-3.3-5.5A3.3 3.3 0 0 1 18 3.4Z"/><circle cx="18" cy="6.7" r="0.4" fill="currentColor"/></svg>`,
  'ft:nutrition': `<svg ${FT_ICON_ATTRS}><path ${FT_SHAPE} d="M12 7.8c-2.1-1.7-5.6-1-6.6 2-1.2 3.6 1.2 8.7 3.5 10.1 1 .7 2.1.7 3.1 0 1 .7 2.1.7 3.1 0 2.3-1.4 4.7-6.5 3.5-10.1-1-3-4.5-3.7-6.6-2Z"/><path ${FT_SHAPE} d="M12 7.8c0-2.1 1.1-3.6 3.1-4.3"/></svg>`,
  'ft:weight': `<svg ${FT_ICON_ATTRS}><rect ${FT_SHAPE} x="4.5" y="3.5" width="15" height="17" rx="3.5"/><path ${FT_SHAPE} d="M8 10a4 4 0 0 1 8 0Z"/><path ${FT_SHAPE} d="m12 10 1.5-2"/></svg>`,
  'ft:progress': `<svg ${FT_ICON_ATTRS}><path ${FT_SHAPE} d="M4 19.5V4.5M4 19.5h16"/><path ${FT_SHAPE} d="m7 14 4-4 3 2 5-6"/></svg>`,
  'ft:profile': `<svg ${FT_ICON_ATTRS}><circle ${FT_SHAPE} cx="12" cy="8" r="3.5"/><path ${FT_SHAPE} d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>`,
  'ft:settings': `<svg ${FT_ICON_ATTRS}><path ${FT_SHAPE} d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--menu-surface)"/><circle ${FT_SHAPE} cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2" fill="var(--menu-surface)"/></svg>`,
  'ft:sign-out': `<svg ${FT_ICON_ATTRS}><path ${FT_SHAPE} d="M9 4.5H5.5A1.5 1.5 0 0 0 4 6v12a1.5 1.5 0 0 0 1.5 1.5H9"/><path ${FT_SHAPE} d="M10 12h10m-3.5-3.5L20 12l-3.5 3.5"/></svg>`,
};

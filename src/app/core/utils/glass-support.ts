/** DevTools can emulate an iPhone user agent while still using Chromium's renderer. */
export function canUseGlassRefraction(userAgent: string, hasChromiumRuntime: boolean, supportsSvgBackdrop: boolean): boolean {
  return supportsSvgBackdrop && (hasChromiumRuntime || /Chrome|Chromium|Edg\//.test(userAgent));
}

export function supportsGlassRefraction(): boolean {
  return canUseGlassRefraction(
    navigator.userAgent,
    'chrome' in window,
    CSS.supports('backdrop-filter', 'url("#ft-dock-lens")'),
  );
}

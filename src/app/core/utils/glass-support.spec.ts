import { canUseGlassRefraction } from './glass-support';

describe('glass renderer detection', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
  it('keeps refraction enabled when desktop Chromium emulates an iPhone', () => {
    expect(canUseGlassRefraction(iphone, true, true)).toBe(true);
  });
  it('keeps the CSS fallback on actual Safari', () => {
    expect(canUseGlassRefraction(iphone, false, true)).toBe(false);
  });
  it('requires SVG backdrop support even in Chromium', () => {
    expect(canUseGlassRefraction('Chrome/140.0', true, false)).toBe(false);
  });
});

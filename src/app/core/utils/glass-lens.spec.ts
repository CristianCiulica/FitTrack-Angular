import { glassLensPixels } from './glass-lens';

describe('dock refraction lens', () => {
  it('keeps the centre flat and bends opposite edges in opposite directions', () => {
    const width = 360;
    const height = 66;
    const pixels = glassLensPixels(width, height);
    const at = (x: number, y: number) => Array.from(pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 4));
    expect(at(180, 33)).toEqual([128, 128, 128, 255]);
    expect(at(180, 1)[1]).toBeLessThan(128);
    expect(at(180, 64)[1]).toBeGreaterThan(128);
    expect(at(1, 33)[0]).toBeLessThan(128);
    expect(at(358, 33)[0]).toBeGreaterThan(128);
  });
});

it('keeps a tall rounded panel flat inside and refracts all four rims', () => {
  const width = 280, height = 420;
  const pixels = glassLensPixels(width, height, 32);
  const channel = (x: number, y: number, c: number) => pixels[(y * width + x) * 4 + c];
  expect(channel(140, 210, 0)).toBe(128);
  expect(channel(140, 210, 1)).toBe(128);
  expect(channel(1, 210, 0)).toBeLessThan(128);
  expect(channel(278, 210, 0)).toBeGreaterThan(128);
  expect(channel(140, 1, 1)).toBeLessThan(128);
  expect(channel(140, 418, 1)).toBeGreaterThan(128);
});

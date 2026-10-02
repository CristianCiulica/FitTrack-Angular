/** A capsule's surface normals, encoded for SVG feDisplacementMap.
 * The flat centre stays neutral; only the curved rim bends the backdrop.
 * No noise/turbulence: the lens follows the actual shape of the control.
 */
export function glassLensPixels(width: number, height: number, cornerRadius = Math.min(width, height) / 2): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const radius = Math.max(1, Math.min(cornerRadius, width / 2, height / 2));
  const rim = Math.min(15, radius);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cx = Math.max(radius, Math.min(width - radius, x + 0.5));
      const dx = x + 0.5 - cx;
      const cy = Math.max(radius, Math.min(height - radius, y + 0.5));
      const dy = y + 0.5 - cy;
      const distance = Math.hypot(dx, dy);
      const depth = radius - distance;
      const curve = depth >= 0 && depth < rim ? Math.pow(1 - depth / rim, 2) : 0;
      const strength = curve * 110 / (distance || 1);
      const index = (y * width + x) * 4;
      pixels[index] = Math.round(128 + dx * strength);
      pixels[index + 1] = Math.round(128 + dy * strength);
      pixels[index + 2] = 128;
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

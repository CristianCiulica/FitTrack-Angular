export function createWorkoutSummaryImage(summary: {
  name: string;
  date: string;
  durationSeconds: number;
  sets: number;
  hasTimedCardio?: boolean;
  calories: number;
  volumeKg: number | null;
  volumeChangeKg: number | null;
}): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image export unavailable');
  const light = document.documentElement.dataset['theme'] === 'light';
  const ink = light ? '#141419' : '#f5f5f7';
  const muted = light ? '#5c5e68' : '#9b9ca6';
  ctx.scale(3, 3);
  ctx.fillStyle = light ? '#fafafa' : '#0b0b0e';
  ctx.fillRect(0, 0, 360, 450);
  const draw = (value: string, x: number, y: number, size: number, weight: number, color = ink, width = 312) => {
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y, width);
  };
  draw('FitTrack.', 24, 39, 16, 750);
  ctx.textAlign = 'right';
  draw(new Date(summary.date.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }), 336, 39, 12, 500, muted);
  ctx.textAlign = 'left';
  const title = summary.name.trim().replace(/\s+workout$/i, '');
  draw(title, 24, 104, 64, 800);
  draw('Workout', 24, 165, 64, 800);
  ctx.fillStyle = muted;
  ctx.fillRect(24, 196, 312, 4);
  draw(`${summary.sets} ${summary.hasTimedCardio ? 'steps' : 'sets'} completed`, 24, 223, 13, 650);
  ctx.fillStyle = light ? '#dedee2' : '#222226';
  ctx.fillRect(24, 246, 312, 1);
  ctx.fillRect(24, 330, 312, 1);
  ctx.fillRect(180, 246, 1, 84);
  draw('DURATION', 24, 275, 10, 650, muted);
  draw('BURNED', 199, 275, 10, 650, muted);
  const clock = Math.floor(summary.durationSeconds / 60) + ':' + String(summary.durationSeconds % 60).padStart(2, '0');
  for (const [value, unit, x] of [[clock, 'min', 24], [String(summary.calories), 'kcal', 199]] as const) {
    draw(value, x, 309, 28, 750, ink, 100);
    draw(unit, x + Math.min(100, ctx.measureText(value).width) + 4, 309, 13, 550, muted);
  }
  if (summary.volumeKg !== null) {
    const kg = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
    draw('TOTAL LIFTED', 24, 359, 10, 650, muted);
    draw(kg.format(summary.volumeKg) + ' kg', 24, 393, 32, 750);
    if (summary.volumeChangeKg !== null) {
      const change = summary.volumeChangeKg;
      draw((change > 0 ? '+' : '') + kg.format(change) + ' kg vs last session', 24, 420, 14, 550, muted);
    }
  }
  return canvas.toDataURL('image/png');
}

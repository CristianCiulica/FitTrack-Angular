import { WeightEntry } from '../models/weight-entry.model';
export const POUNDS_PER_KG = 2.2046226218;
export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function weightChart(entries: WeightEntry[], days: number, today = new Date(), imperial = false) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - days + 1);
  const cutoff = days ? localDateKey(start) : '0000-00-00';
  const data = entries.filter(entry => entry.date >= cutoff && entry.date <= localDateKey(today)).sort((a,b) => a.date.localeCompare(b.date));
  const values = data.map(entry => entry.weightKg * (imperial ? POUNDS_PER_KG : 1));
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 0;
  const pad = Math.max((high - low) * .2, imperial ? 1 : .5);
  const min = low - pad, max = high + pad;
  const timestamp = (date: string) => Date.parse(`${date}T12:00:00Z`);
  const first = data.length ? timestamp(data[0].date) : 0;
  const last = data.length ? timestamp(data[data.length - 1].date) : 0;
  const points = data.map((entry,i) => ({ ...entry, value: values[i],
    x: first === last ? 180 : 8 + (timestamp(entry.date) - first) / (last - first) * 344,
    y: 12 + (max - values[i]) / (max - min) * 156,
  }));
  return { points, min, max, mid: (min + max) / 2, path: points.map((p,i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '),
    change: values.length > 1 ? values[values.length-1] - values[0] : null };
}

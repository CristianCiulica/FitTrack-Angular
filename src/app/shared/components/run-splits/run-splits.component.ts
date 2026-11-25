import { Component, computed, input } from '@angular/core';
import { RunningSession } from '../../../core/models/running-session.model';
import { runSplits } from '../../../core/utils/run-splits';

@Component({
  selector: 'app-run-splits',
  template: `
    @if (splits().length) {
      <table>
        <caption>Kilometre splits</caption>
        <thead><tr><th scope="col">Distance</th><th scope="col">Time</th><th scope="col">Pace / km</th></tr></thead>
        <tbody>
          @for (split of splits(); track $index) {
            <tr>
              <th scope="row">{{ split.metres === 1000 ? 'Km ' + ($index + 1) : 'Last ' + metres(split.metres) + ' m' }}</th>
              <td>{{ clock(split.seconds) }}</td>
              <td>{{ split.seconds ? clock(split.seconds * 1000 / split.metres) : '—' }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
  styles: `
    table { width: 100%; margin: 18px 0; border-collapse: collapse; color: var(--ink); font-variant-numeric: tabular-nums; }
    caption { caption-side: top; padding: 0 0 8px; text-align: left; color: inherit; font-size: 17px; font-weight: 650; }
    th, td { padding: 8px 0; text-align: right; }
    th:first-child { text-align: left; }
    thead th { color: var(--ink-secondary); font-size: 12px; font-weight: 500; }
    tbody th, td { border-top: 1px solid var(--hairline); font-size: 14px; }
    tbody th { font-weight: 550; }
  `,
})
export class RunSplitsComponent {
  readonly session = input.required<Pick<RunningSession, 'distanceMeters' | 'durationSeconds' | 'kilometreTimes'>>();
  readonly splits = computed(() => runSplits(this.session()));
  metres(distance: number) { return Math.max(1, Math.min(999, Math.round(distance))); }
  clock(seconds: number) {
    const rounded = Math.round(seconds);
    return Math.floor(rounded / 60) + ':' + String(rounded % 60).padStart(2, '0');
  }
}

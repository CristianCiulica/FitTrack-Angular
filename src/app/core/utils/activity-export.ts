import { timedSession } from './timed-cardio';
import { Workout } from '../models/workout.model';
import { RunningSession } from '../models/running-session.model';
import { UserProfile } from '../models/user-profile.model';
import { WeightEntry } from '../models/weight-entry.model';
import { isWorkoutSession } from './workout-kind';
import { workoutVolume, durationLabel } from './workout-history';
import { exerciseRecords } from './exercise-records';
import { trainingProgress } from './training-progress';
import { readProgramEnrollment, readProgramSession } from './program-records';
import { localDateKey } from './weight-progress';
import { displayWeight, weightUnitLabel, displayDistance, distanceUnitLabel } from './units';

export interface ActivityExport {
  exportedAt: string;
  profile: UserProfile | null;
  workouts: Workout[];
  runningSessions: RunningSession[];
  weightEntries: WeightEntry[];
}

export function compactActivityExport(data: ActivityExport) {
  const p = data.profile;
  return {
    exportedAt: data.exportedAt,
    units: { weight: 'kg', distance: 'm', duration: 's' },
    profile: p
      ? { name: p.displayName, heightCm: p.heightCm, weightKg: p.weightKg, goal: p.goal }
      : null,
    weights: data.weightEntries.map((e) => ({ date: e.date, kg: e.weightKg })),
    workouts: data.workouts.filter(isWorkoutSession).map((w) => ({
      name: w.name,
      date: w.date,
      ...(w.durationSeconds != null ? { seconds: w.durationSeconds } : {}),
      exercises: w.exercises
        .filter((e) => e.sets > 0)
        .map((e) => ({
          name: e.exerciseName,
          group: e.muscleGroup,
          ...(e.repUnit ? { unit: e.repUnit } : {}),
          sets: Array.from({ length: e.sets }, (_, i) => [
            e.setWeights?.[i] ?? e.weight,
            e.setReps?.[i] ?? e.reps,
          ]),
          ...(e.dropSets?.length
            ? {
                drops: e.dropSets.map((d) => ({ set: d.setIndex + 1, kg: d.weight, reps: d.reps })),
              }
            : {}),
        })),
      ...(readProgramSession(w)
        ? {
            program: {
              name: readProgramSession(w)!.programId,
              session: readProgramSession(w)!.dayIndex + 1,
              completed: readProgramSession(w)!.completed,
            },
          }
        : {}),
      ...(timedSession(w)
        ? {
            treadmill: timedSession(w)!.treadmill.map((t) => ({
              seconds: t.seconds,
              targetSeconds: t.targetSeconds,
            })),
          }
        : {}),
    })),
    runs: data.runningSessions.map((r) => ({
      mode: r.mode,
      date: r.startedAt,
      seconds: r.durationSeconds,
      meters: r.distanceMeters,
      steps: r.steps,
      kcal: r.calories,
    })),
    plans: data.workouts
      .map(readProgramEnrollment)
      .filter(Boolean)
      .map((e) => ({
        program: e!.programId,
        start: e!.startDate,
        ...(e!.stoppedAt ? { stopped: e!.stoppedAt } : {}),
      })),
  };
}

const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function achievementReportHtml(data: ActivityExport): string {
  const today = new Date(),
    key = localDateKey(today),
    units = data.profile?.units ?? 'metric';
  const weight = (kg: number) => `${displayWeight(kg, units)} ${weightUnitLabel(units)}`;
  const distance = (m: number) =>
    `${displayDistance(m, units).toFixed(2)} ${distanceUnitLabel(units)}`;
  const workouts = data.workouts.filter((w) => isWorkoutSession(w) && w.date.slice(0, 10) <= key);
  const runs = data.runningSessions.filter((r) => r.startedAt.slice(0, 10) <= key);
  const progress = trainingProgress(workouts, runs, today, today);
  const dates = [
    ...new Set([
      ...workouts.map((w) => w.date.slice(0, 10)),
      ...runs.map((r) => r.startedAt.slice(0, 10)),
    ]),
  ].sort();
  let bestStreak = 0,
    streak = 0,
    previous = 0;
  for (const date of dates) {
    const time = Date.parse(date + 'T12:00:00Z');
    streak = time - previous === 86400000 ? streak + 1 : 1;
    bestStreak = Math.max(bestStreak, streak);
    previous = time;
  }
  const records = [
    ...exerciseRecords(workouts, key),
    ...exerciseRecords(workouts, key, true).filter((r) => r.bestWeight.weight === 0),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const weights = data.weightEntries
    .filter((e) => e.date <= key)
    .sort((a, b) => a.date.localeCompare(b.date));
  const plans = data.workouts.map(readProgramEnrollment).filter(Boolean);
  const completedPlanSessions = workouts.filter((w) => readProgramSession(w)?.completed).length;
  const card = (label: string, value: string) =>
    `<div class="metric"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>FitTrack — Achievements</title><style>
  @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:13px system-ui,sans-serif;color:#202124;margin:0;line-height:1.5}header{border-bottom:3px solid #0071e3;padding-bottom:12px;margin-bottom:16px}h1{font-size:28px;letter-spacing:-1px;margin:8px 0}h2{font-size:18px;margin:18px 0 8px}p{margin:6px 0;color:#555}.brand{font-weight:750;color:#0071e3}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.metric{padding:10px;background:#f4f5f7;border-radius:12px;break-inside:avoid}.metric span{display:block;font-size:11px;color:#555}.metric strong{display:block;font-size:18px;margin-top:3px}.badges{display:grid;grid-template-columns:1fr 1fr;gap:8px}.badge{padding:10px 14px;border:1px solid #ddd;border-radius:10px;margin:0;break-inside:avoid}.badge b{display:block}footer{margin-top:16px;font-size:10px;color:#777}button{padding:12px 20px;background:#0071e3;color:white;border:0;border-radius:10px;cursor:pointer;margin:16px 0}@media print{button{display:none}.metric{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body><header><div class="brand">FitTrack.</div><h1>Your achievements</h1><p>${escape(data.profile?.displayName || 'Your training journey')} · ${escape(today.toLocaleDateString('en-GB'))}</p></header><button type="button" onclick="window.print()">Save as PDF / Print</button>
  <div class="metrics">${card('Workouts completed', String(workouts.length))}${card('Runs & walks', String(runs.length))}${card('Active days', String(dates.length))}${card('Best streak', bestStreak + (bestStreak === 1 ? ' day' : ' days'))}${card('Training time', durationLabel(workouts.reduce((s, w) => s + (w.durationSeconds ?? 0), 0) + runs.reduce((s, r) => s + r.durationSeconds, 0)))}${card('Total lifting volume', weight(Math.round(workouts.reduce((s, w) => s + workoutVolume(w), 0))))}${card('Distance', distance(runs.reduce((s, r) => s + r.distanceMeters, 0)))}${card('Plans started', String(plans.length))}${card('Plan sessions completed', String(completedPlanSessions))}</div>
  <h2>Unlocked achievements</h2><div class="badges">${
    progress.milestones
      .filter((m) => m.earned)
      .map((m) => `<div class="badge"><b>★ ${escape(m.label)}</b>${escape(m.detail)}</div>`)
      .join('') || '<p>Your first milestone is ahead.</p>'
  }</div>
  <h2>Personal records</h2><p><b>${records.length}</b> exercises tracked · <b>${records.filter((r) => r.bestWeight.weight > r.initial.weight).length}</b> with higher weight records · <b>${records.filter((r) => r.bestReps.reps > r.initial.reps).length}</b> with higher rep records</p>
  <h2>Running & walking records</h2><div class="metrics">${card('Longest session', distance(Math.max(0, ...runs.map((r) => r.distanceMeters))))}${card('Longest duration', durationLabel(Math.max(0, ...runs.map((r) => r.durationSeconds))))}${card('Most steps', String(Math.max(0, ...runs.map((r) => r.steps))))}</div>
  <h2>Body weight</h2>${weights.length ? `<p>Starting: <b>${escape(weight(weights[0].weightKg))}</b> (${escape(weights[0].date)}) · Latest: <b>${escape(weight(weights.at(-1)!.weightKg))}</b> (${escape(weights.at(-1)!.date)})</p>` : `<p>${data.profile?.weightKg ? escape(weight(data.profile.weightKg)) : 'No weigh-ins recorded.'}</p>`}
  <footer>Based on your completed FitTrack history. Weight values represent logged loads. Calorie estimates are not measurements.</footer></body></html>`;
}

export function downloadActivityJson(data: ActivityExport): void {
  const blob = new Blob([JSON.stringify(compactActivityExport(data))], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = 'fittrack-export.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

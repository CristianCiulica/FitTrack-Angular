const pulseMs = { confirm: 30, hold: 80, restComplete: 200 } as const;

export function vibrate(cue: keyof typeof pulseMs): void {
  globalThis.navigator?.vibrate?.(pulseMs[cue]);
}

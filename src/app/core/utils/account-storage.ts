export function eraseAccountStorage(uid: string): void {
  if (!uid) return;
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
    for (const key of keys)
      if (key?.startsWith('fittrack_') && key.endsWith(`:${uid}`)) localStorage.removeItem(key);
  } catch {
    /* Browser storage may already be inaccessible. */
  }
}

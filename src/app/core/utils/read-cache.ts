import { concat, defer, filter, finalize, map, Observable, of, shareReplay, tap } from 'rxjs';

/** Immediate per-account snapshots and one shared refresh; old reads cannot undo edits. */
export class ReadCache<T> {
  private owner: string | null = null;
  private value!: T;
  private revision = 0;
  private confirmedAt = 0;
  private pending: Observable<T> | null = null;

  constructor(private readonly maxAgeMs = 30_000) {}

  read(owner: string, seed: () => T, load: () => Observable<T>, accept: (value: T) => void, force = false): Observable<T> {
    return defer(() => {
      if (this.owner !== owner) {
        this.owner = owner;
        this.value = seed();
        this.revision++;
        this.confirmedAt = 0;
        this.pending = null;
      }
      if (!force && this.confirmedAt && Date.now() - this.confirmedAt < this.maxAgeMs) {
        return of(this.value);
      }
      if (!this.pending) {
        const revision = this.revision;
        const request = defer(load).pipe(
          filter(() => this.owner === owner),
          map(value => revision === this.revision ? value : this.value),
          tap(value => {
            if (revision !== this.revision) return;
            this.value = value;
            this.confirmedAt = Date.now();
            accept(value);
          }),
          // accept may synchronously confirm an offline upload and replace its id.
          map(() => this.value),
          finalize(() => { if (this.pending === request) this.pending = null; }),
          shareReplay({ bufferSize: 1, refCount: true }),
        );
        this.pending = request;
      }
      return concat(of(this.value), this.pending);
    });
  }

  replace(owner: string, value: T): void {
    if (this.owner !== owner) return;
    this.value = value;
    this.revision++;
    this.confirmedAt = 0;
    this.pending = null;
  }
}

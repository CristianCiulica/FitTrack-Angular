import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { ReadCache } from './read-cache';

describe('Account read cache', () => {
  afterEach(() => vi.useRealTimers());
  it('renders the snapshot immediately and coalesces concurrent refreshes', () => {
    const cache = new ReadCache<number[]>();
    const response = new Subject<number[]>();
    const load = vi.fn(() => response);
    const values: number[][] = [];
    const read = () => cache.read('a', () => [1], load, () => {});
    read().subscribe(value => values.push(value));
    read().subscribe();
    expect(values).toEqual([[1]]);
    expect(load).toHaveBeenCalledOnce();
    response.next([2]); response.complete();
    read().subscribe(value => values.push(value));
    expect(values.at(-1)).toEqual([2]);
    expect(load).toHaveBeenCalledOnce();
  });
  it('refreshes expired data and does not let an old GET restore a deleted item', () => {
    vi.useFakeTimers();
    const cache = new ReadCache<number[]>();
    const accept = vi.fn();
    cache.read('a', () => [], () => of([1, 2]), accept).subscribe();
    vi.advanceTimersByTime(30_001);
    const response = new Subject<number[]>();
    const values: number[][] = [];
    cache.read('a', () => [], () => response, accept).subscribe(value => values.push(value));
    cache.replace('a', [2]);
    response.next([1, 2]); response.complete();
    expect(values.at(-1)).toEqual([2]);
    expect(accept).toHaveBeenCalledTimes(1);
  });
  it('never emits the previous account or its delayed response after switching accounts', () => {
    const cache = new ReadCache<number[]>();
    const old = new Subject<number[]>();
    const accept = vi.fn();
    cache.read('a', () => [1], () => old, accept).subscribe();
    const values: number[][] = [];
    cache.read('b', () => [], () => of([3]), accept).subscribe(value => values.push(value));
    old.next([9]); old.complete();
    expect(values).toEqual([[], [3]]);
    expect(accept).toHaveBeenCalledOnce();
    expect(accept).toHaveBeenCalledWith([3]);
  });
  it('cancels a refresh when its final subscriber leaves and allows a new refresh', () => {
    const cache = new ReadCache<number[]>();
    const load = vi.fn(() => new Subject<number[]>());
    const read = () => cache.read('a', () => [], load, () => {});
    const subscription = read().subscribe();
    subscription.unsubscribe();
    read().subscribe();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

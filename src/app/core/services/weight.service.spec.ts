import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from './api.service';
import { WeightService } from './weight.service';

describe('Weight loading', () => {
  let service: WeightService;
  let api: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };
  const entries = [{ date: '2026-10-03', weightKg: 75 }];
  beforeEach(() => {
    api = { get: vi.fn(() => of({ entries })), put: vi.fn() };
    TestBed.configureTestingModule({ providers: [
      { provide: ApiService, useValue: api }, { provide: Auth, useValue: { currentUser: { uid: 'a' } } },
    ] });
    service = TestBed.inject(WeightService);
  });
  it('does not present a fabricated empty history before the first response', () => {
    const response = new Subject<{ entries: typeof entries }>();
    api.get.mockReturnValue(response);
    const emit = vi.fn();
    service.getEntries().subscribe(emit);
    expect(emit).not.toHaveBeenCalled();
    response.next({ entries }); response.complete();
    expect(emit).toHaveBeenCalledWith(entries);
  });
  it('returns confirmed history immediately on repeated navigation', () => {
    service.getEntries().subscribe();
    const emit = vi.fn();
    service.getEntries().subscribe(emit);
    expect(emit).toHaveBeenCalledWith(entries);
    expect(api.get).toHaveBeenCalledOnce();
  });
  it('keeps a confirmed edit when an older refresh finishes later', () => {
    service.getEntries().subscribe();
    const response = new Subject<{ entries: typeof entries }>();
    api.get.mockReturnValue(response);
    const emit = vi.fn();
    service.getEntries(true).subscribe(emit);
    const updated = [{ ...entries[0], weightKg: 74 }];
    api.put.mockReturnValue(of({ entries: updated, profile: {} }));
    service.save(entries[0].date, 74).subscribe();
    response.next({ entries }); response.complete();
    expect(emit).toHaveBeenLastCalledWith(updated);
  });
});

// ALMOST CHOSEN — Persistent Anonymous Archive
// Persistence: localStorage. Real-time cross-page sync: BroadcastChannel.
// A record NEVER contains the full wish text. Only the anonymous numerical
// trace + outcome are ever stored or broadcast.

import type { Category, DrawResult, Outcome } from './engine';
import { OUTCOMES } from './engine';

const STORAGE_KEY = 'almost-chosen/archive/v1';
const CHANNEL_NAME = 'almost-chosen/archive';

export interface ArchiveRecord {
  ticketId: string;
  category: Category;
  result: Outcome;
  wishNumber: number;
  systemNumber: number;
  distance: number;
  generatedAt: number;
  isTest?: boolean; // ADMIN test flow only; excluded from public stats by default
  // NOTE: intentionally NO wish text field. Ever.
}

export interface ArchiveState {
  launchedAt: number;
  records: ArchiveRecord[];
}

export interface OutcomeCounts {
  total: number;
  counts: Record<Outcome, number>;
  percentages: Record<Outcome, number>;
}

type Listener = (state: ArchiveState) => void;

function emptyState(): ArchiveState {
  return { launchedAt: Date.now(), records: [] };
}

function load(): ArchiveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = emptyState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as ArchiveState;
    if (!parsed.records || !Array.isArray(parsed.records)) return emptyState();
    return parsed;
  } catch {
    return emptyState();
  }
}

function persist(state: ArchiveState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage may be unavailable; the in-memory state still drives the UI
  }
}

/**
 * ArchiveStore is a small singleton so the participant page and the
 * projection page share one synchronized, anonymized archive.
 */
class ArchiveStore {
  private state: ArchiveState = load();
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<Listener>();

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (ev: MessageEvent) => {
        const msg = ev.data as { type: string; state?: ArchiveState };
        if (msg && msg.type === 'sync' && msg.state) {
          this.state = msg.state;
          this.notify();
        }
      };
    }
    // Fallback / secondary sync path across tabs via storage events.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (ev) => {
        if (ev.key === STORAGE_KEY && ev.newValue) {
          try {
            this.state = JSON.parse(ev.newValue) as ArchiveState;
            this.notify();
          } catch {
            /* ignore malformed */
          }
        }
      });
    }
  }

  getState(): ArchiveState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const l of this.listeners) l(this.state);
  }

  private broadcast(): void {
    if (this.channel) {
      this.channel.postMessage({ type: 'sync', state: this.state });
    }
  }

  /**
   * Record a draw. Only the anonymous trace is stored — the wish text from
   * the DrawResult's caller is never passed in and never persisted.
   */
  record(draw: DrawResult): void {
    const rec: ArchiveRecord = {
      ticketId: draw.ticketId,
      category: draw.category,
      result: draw.outcome,
      wishNumber: draw.wishNumber,
      systemNumber: draw.systemNumber,
      distance: draw.distance,
      generatedAt: draw.generatedAt,
      ...(draw.isTest ? { isTest: true } : {}),
    };
    this.state = { ...this.state, records: [...this.state.records, rec] };
    persist(this.state);
    this.broadcast();
    this.notify();
  }

  /**
   * Record from an already-anonymised public payload (ticketId/category/
   * result/wishNumber/systemDraw/circularDistance/generatedAt). No wishText
   * exists on this path. Idempotent by ticketId so a retried print or a
   * double submission never inserts a second archive record.
   */
  recordPublic(rec: {
    ticketId: string;
    category: Category;
    result: Outcome;
    wishNumber: number;
    systemDraw: number;
    circularDistance: number;
    generatedAt: number;
    isTest?: boolean;
  }): void {
    if (this.state.records.some((r) => r.ticketId === rec.ticketId)) return;
    const entry: ArchiveRecord = {
      ticketId: rec.ticketId,
      category: rec.category,
      result: rec.result,
      wishNumber: rec.wishNumber,
      systemNumber: rec.systemDraw,
      distance: rec.circularDistance,
      generatedAt: rec.generatedAt,
      ...(rec.isTest ? { isTest: true } : {}),
    };
    this.state = { ...this.state, records: [...this.state.records, entry] };
    persist(this.state);
    this.broadcast();
    this.notify();
  }

  /** Clear the entire anonymous archive and restart uptime. Admin only. */
  reset(): void {
    this.state = emptyState();
    persist(this.state);
    this.broadcast();
    this.notify();
  }

  /**
   * Re-notify + re-broadcast the current state without changing it. Used when
   * an external setting (e.g. INCLUDE TEST RECORDS) changes and every view
   * needs to recompute its derived aggregates against the same records.
   */
  resync(): void {
    this.broadcast();
    this.notify();
  }

  /**
   * Remove ONLY test records (isTest: true) from the archive. Real production
   * records are untouched. Used by the hidden admin "CLEAR TEST RECORDS"
   * control and after a test session ends.
   */
  clearTestRecords(): void {
    const kept = this.state.records.filter((r) => !r.isTest);
    if (kept.length === this.state.records.length) return;
    this.state = { ...this.state, records: kept };
    persist(this.state);
    this.broadcast();
    this.notify();
  }
}

export const archiveStore = new ArchiveStore();

// ---- Derived aggregate selectors (used by the projection) ----
//
// includeTest defaults to FALSE everywhere so admin test records (isTest:true)
// never pollute public statistics unless an admin explicitly opts in via the
// INCLUDE TEST RECORDS toggle.

/** Real production records only (test records excluded), unless includeTest. */
export function visibleRecords(
  state: ArchiveState,
  includeTest = false,
): ArchiveRecord[] {
  return includeTest ? state.records : state.records.filter((r) => !r.isTest);
}

/** All test records (isTest:true), newest first. */
export function testRecords(state: ArchiveState): ArchiveRecord[] {
  return [...state.records].filter((r) => r.isTest).reverse();
}

/** The single newest test record, or null. */
export function latestTestRecord(state: ArchiveState): ArchiveRecord | null {
  const list = testRecords(state);
  return list.length > 0 ? list[0] : null;
}

export function computeOutcomeCounts(
  state: ArchiveState,
  includeTest = false,
): OutcomeCounts {
  const records = visibleRecords(state, includeTest);
  const counts = OUTCOMES.reduce(
    (acc, o) => ({ ...acc, [o]: 0 }),
    {} as Record<Outcome, number>,
  );
  for (const r of records) counts[r.result] += 1;
  const total = records.length;
  const percentages = OUTCOMES.reduce((acc, o) => {
    acc[o] = total === 0 ? 0 : Math.round((counts[o] / total) * 100);
    return acc;
  }, {} as Record<Outcome, number>);
  return { total, counts, percentages };
}

export function computeCategoryCounts(
  state: ArchiveState,
  categories: Category[],
  includeTest = false,
): { category: Category; count: number }[] {
  const records = visibleRecords(state, includeTest);
  return categories.map((category) => ({
    category,
    count: records.filter((r) => r.category === category).length,
  }));
}

export function recentRecords(
  state: ArchiveState,
  limit: number,
  includeTest = false,
): ArchiveRecord[] {
  return visibleRecords(state, includeTest).slice(-limit).reverse();
}

export function uptimeLabel(launchedAt: number, nowMs: number): string {
  const secs = Math.max(0, Math.floor((nowMs - launchedAt) / 1000));
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${d} · ${h.toString().padStart(2, '0')}H · ${m.toString().padStart(2, '0')}M`;
}
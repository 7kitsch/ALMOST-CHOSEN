// ALMOST CHOSEN — Immutable ticket record, public/private payloads,
// print calibration, and the documented Web↔Electron integration bridge.
//
// ONE immutable record is created per submission and drives every view. The
// PRIVATE payload may include wishText (participant + hidden print window
// only). The PUBLIC payload NEVER includes wishText and is the only thing the
// projection / archive ever receive.

import type { Category, DrawResult, Outcome } from './engine';
import { outcomeRangeLabel } from './engine';

// ---------------------------------------------------------------------------
// Immutable record shapes
// ---------------------------------------------------------------------------

/** PRIVATE payload — participant screen + hidden print window ONLY. */
export interface PrivateTicketRecord {
  ticketId: string;
  category: Category;
  result: Outcome;
  wishNumber: number;
  systemDraw: number;
  directDifference: number;
  wrapAroundDistance: number;
  circularDistance: number;
  outcomeRange: string;
  generatedAt: number;
  wishText: string; // PRIVATE — never leaves the participant / print context
  isTest?: boolean; // ADMIN test flow only; never set in the production draw
}

/** PUBLIC payload — projection + persistent anonymous archive ONLY. */
export interface PublicTicketRecord {
  ticketId: string;
  category: Category;
  result: Outcome;
  wishNumber: number;
  systemDraw: number;
  circularDistance: number;
  generatedAt: number;
  isTest?: boolean; // ADMIN test flow only; used to keep test events out of public stats
  // NOTE: intentionally NO wishText, no directDifference/wrap (not needed publicly).
}

/** Build the immutable PRIVATE record from an engine DrawResult + wish text. */
export function toPrivateRecord(draw: DrawResult, wishText: string): PrivateTicketRecord {
  return {
    ticketId: draw.ticketId,
    category: draw.category,
    result: draw.outcome,
    wishNumber: draw.wishNumber,
    systemDraw: draw.systemNumber,
    directDifference: draw.directDifference,
    wrapAroundDistance: draw.wrapAroundDistance,
    circularDistance: draw.distance,
    outcomeRange: outcomeRangeLabel(draw.distance),
    generatedAt: draw.generatedAt,
    wishText,
    ...(draw.isTest ? { isTest: true } : {}),
  };
}

/** Strip a PRIVATE record down to the PUBLIC payload (drops wishText). */
export function toPublicRecord(rec: PrivateTicketRecord): PublicTicketRecord {
  return {
    ticketId: rec.ticketId,
    category: rec.category,
    result: rec.result,
    wishNumber: rec.wishNumber,
    systemDraw: rec.systemDraw,
    circularDistance: rec.circularDistance,
    generatedAt: rec.generatedAt,
    ...(rec.isTest ? { isTest: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Print calibration (ONE global transform — never move individual modules)
// ---------------------------------------------------------------------------

export interface PrintCalibration {
  offsetXmm: number; // horizontal shift, +right
  offsetYmm: number; // vertical shift, +down
  scalePercent: number; // uniform scale, 100 = exact
}

export const DEFAULT_CALIBRATION: PrintCalibration = {
  offsetXmm: 0,
  offsetYmm: 0,
  scalePercent: 100,
};

const CALIB_KEY = 'almost-chosen/print-calibration/v1';

export function loadCalibration(): PrintCalibration {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_CALIBRATION };
  try {
    const raw = localStorage.getItem(CALIB_KEY);
    if (!raw) return { ...DEFAULT_CALIBRATION };
    const parsed = JSON.parse(raw) as Partial<PrintCalibration>;
    return {
      offsetXmm: typeof parsed.offsetXmm === 'number' ? parsed.offsetXmm : 0,
      offsetYmm: typeof parsed.offsetYmm === 'number' ? parsed.offsetYmm : 0,
      scalePercent:
        typeof parsed.scalePercent === 'number' ? parsed.scalePercent : 100,
    };
  } catch {
    return { ...DEFAULT_CALIBRATION };
  }
}

export function saveCalibration(cal: PrintCalibration): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CALIB_KEY, JSON.stringify(cal));
  } catch {
    /* ignore */
  }
}

// A6 geometry, shared by the renderers and the calibration transform.
export const A6_WIDTH_MM = 105;
export const A6_HEIGHT_MM = 148;
export const A6_DPI = 300;
export const A6_WIDTH_PX = 1240; // 105mm @ 300dpi ≈ 1240
export const A6_HEIGHT_PX = 1748; // 148mm @ 300dpi ≈ 1748
export const MM_TO_PX = A6_WIDTH_PX / A6_WIDTH_MM; // ≈ 11.81 px/mm

/**
 * Compute the CSS transform string that applies calibration to the whole
 * ticket document as ONE transform (translate + uniform scale about centre).
 * Used by the /print page and export flow so no module is moved individually.
 */
export function calibrationTransform(cal: PrintCalibration): string {
  const tx = cal.offsetXmm; // mm
  const ty = cal.offsetYmm; // mm
  const s = cal.scalePercent / 100;
  return `translate(${tx}mm, ${ty}mm) scale(${s})`;
}

// ---------------------------------------------------------------------------
// Integration bridge — documented events for the future Electron wrapper.
//
// WHERE ELECTRON CONNECTS (documented seams):
//   - display management     : listen in the Electron main process; this bus
//                              is renderer-side only.
//   - hidden print window    : render /print with the PRIVATE record, then
//                              wait for TICKET_RENDER_READY before printing.
//   - silent printing        : on TICKET_RENDER_READY, main process calls
//                              webContents.print({ silent, deviceName, ... }).
//   - print success/failure  : main process emits PRINT_SUCCESS / PRINT_FAILED
//                              back through preload IPC; forward them here.
//   - retry last ticket      : reuse the SAME PrivateTicketRecord — never
//                              reroll, never mint a new ticketId, never insert
//                              a second archive record.
// ---------------------------------------------------------------------------

export type IntegrationEvent =
  | 'TICKET_RECORD_CREATED'
  | 'PUBLIC_RECORD_READY'
  | 'TICKET_RENDER_STARTED'
  | 'TICKET_RENDER_READY'
  | 'WEB_PRINT_REQUESTED'
  | 'PRINT_SUCCESS'
  | 'PRINT_FAILED'
  | 'RESET_COMPLETE';

export interface IntegrationPayloads {
  TICKET_RECORD_CREATED: PrivateTicketRecord;
  PUBLIC_RECORD_READY: PublicTicketRecord;
  TICKET_RENDER_STARTED: { ticketId: string };
  TICKET_RENDER_READY: { ticketId: string };
  WEB_PRINT_REQUESTED: { ticketId: string };
  PRINT_SUCCESS: { ticketId: string };
  PRINT_FAILED: { ticketId: string; reason?: string };
  RESET_COMPLETE: { at: number };
}

type Handler<E extends IntegrationEvent> = (payload: IntegrationPayloads[E]) => void;

class IntegrationBridge {
  private handlers = new Map<IntegrationEvent, Set<(p: unknown) => void>>();

  on<E extends IntegrationEvent>(event: E, handler: Handler<E>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    const wrapped = handler as (p: unknown) => void;
    set.add(wrapped);
    return () => {
      set?.delete(wrapped);
    };
  }

  emit<E extends IntegrationEvent>(event: E, payload: IntegrationPayloads[E]): void {
    const set = this.handlers.get(event);
    if (set) for (const h of set) h(payload);
    // Mirror onto window so a future Electron preload can observe events too.
    if (typeof window !== 'undefined') {
      const w = window as unknown as {
        __ALMOST_CHOSEN_BRIDGE__?: {
          emit?: (e: string, p: unknown) => void;
        };
      };
      try {
        w.__ALMOST_CHOSEN_BRIDGE__?.emit?.(event, payload);
      } catch {
        /* preload not present in the browser prototype */
      }
    }
  }
}

export const integration = new IntegrationBridge();

/**
 * renderTicketForPrint — the single entrypoint a future Electron wrapper (or
 * the Web /print page) calls to request a print-ready ticket. It stores the
 * PRIVATE record where the /print route reads it, emits TICKET_RENDER_STARTED,
 * and returns. The /print route emits TICKET_RENDER_READY once fonts/graphics
 * have painted; only then should the caller start the actual print.
 */
const PRINT_PAYLOAD_KEY = 'almost-chosen/print-payload/v1';

export function renderTicketForPrint(record: PrivateTicketRecord): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(PRINT_PAYLOAD_KEY, JSON.stringify(record));
    } catch {
      /* ignore */
    }
  }
  integration.emit('TICKET_RENDER_STARTED', { ticketId: record.ticketId });
}

export function readPrintPayload(): PrivateTicketRecord | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PRINT_PAYLOAD_KEY);
    return raw ? (JSON.parse(raw) as PrivateTicketRecord) : null;
  } catch {
    return null;
  }
}
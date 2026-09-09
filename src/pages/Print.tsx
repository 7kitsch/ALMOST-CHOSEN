// ALMOST CHOSEN — Hidden print view (/print).
// Renders ONLY the personalised, transparent A6 ticket FRONT at exact
// 105 x 148 mm. No controls, no surrounding interface, no preview background.
//
// It reads the immutable PRIVATE payload written by renderTicketForPrint(),
// applies the ONE global calibration transform, and emits TICKET_RENDER_READY
// after the p5 buffer has painted — the documented seam a future Electron
// wrapper waits on before calling silent print. The Web fallback simply relies
// on the Admin "PRINT TICKET — WEB FALLBACK" button (window.print()).

import { useEffect, useRef, useState } from 'react';
import { useP5Ready } from '@/hooks/useP5';
import {
  performForcedDraw,
  type DrawResult,
  type Outcome,
} from '@/lib/engine';
import {
  calibrationTransform,
  integration,
  loadCalibration,
  readPrintPayload,
  A6_WIDTH_MM,
  A6_HEIGHT_MM,
  type PrivateTicketRecord,
} from '@/lib/ticketRecord';
import { renderTicket, TICKET_H, TICKET_W, type P5Instance } from '@/lib/ticket';

// Rebuild a DrawResult-shaped object from the immutable private payload so the
// existing renderer can draw it. All values come from the stored record.
function toDrawResult(rec: PrivateTicketRecord): DrawResult {
  return {
    ticketId: rec.ticketId,
    archiveCode: rec.ticketId.replace(/^AC-/, '').replace(/-/g, '·'),
    category: rec.category,
    wishNumber: rec.wishNumber,
    systemNumber: rec.systemDraw,
    directDifference: rec.directDifference,
    wrapAroundDistance: rec.wrapAroundDistance,
    distance: rec.circularDistance,
    outcome: rec.result,
    drawnAt: rec.generatedAt,
    generatedAt: rec.generatedAt,
    timezone: 'GMT',
    matrixSeed: hashSeed(rec.ticketId),
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000;
}

export default function Print() {
  const p5Ready = useP5Ready();
  const host = useRef<HTMLDivElement>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!p5Ready || !host.current) return;
    const P5Ctor = (window as unknown as { p5?: new (...a: unknown[]) => unknown }).p5;
    if (!P5Ctor) return;

    // Resolve the record: stored private payload, or a query fallback for QA.
    let rec = readPrintPayload();
    if (!rec) {
      const params = new URLSearchParams(window.location.search);
      const preview = params.get('preview') as Outcome | null;
      if (preview) {
        const d = performForcedDraw('OTHER', preview);
        rec = {
          ticketId: d.ticketId,
          category: d.category,
          result: d.outcome,
          wishNumber: d.wishNumber,
          systemDraw: d.systemNumber,
          directDifference: d.directDifference,
          wrapAroundDistance: d.wrapAroundDistance,
          circularDistance: d.distance,
          outcomeRange: '',
          generatedAt: Date.now(),
          wishText: 'THIS IS A PREVIEW TICKET FOR PRINT ALIGNMENT AND LAYOUT VERIFICATION.',
        };
      }
    }
    if (!rec) {
      setMissing(true);
      return;
    }

    const record = rec;
    const draw = toDrawResult(record);
    const el = host.current;
    el.innerHTML = '';
    integration.emit('TICKET_RENDER_STARTED', { ticketId: record.ticketId });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sketch = new (P5Ctor as any)((p: P5Instance & Record<string, unknown>) => {
      (p as Record<string, unknown>).setup = () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cnv = (p as any).createCanvas(TICKET_W, TICKET_H);
          cnv.parent(el);
          const g = renderTicket(p, draw, record.wishText);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p as any).image(g, 0, 0);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p as any).noLoop();
          // Signal READY on the next frame so the canvas has painted.
          window.requestAnimationFrame(() => {
            integration.emit('TICKET_RENDER_READY', { ticketId: record.ticketId });
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[print] render failed:', err);
        }
      };
    }, el);

    return () => {
      try {
        (sketch as { remove?: () => void }).remove?.();
      } catch {
        /* noop */
      }
      el.innerHTML = '';
    };
  }, [p5Ready]);

  const cal = loadCalibration();

  return (
    <>
      {/* Exact A6 print CSS — transparent, no headers/footers, no margins. */}
      <style>{`
        @page { size: A6 portrait; margin: 0; }
        html, body {
          width: ${A6_WIDTH_MM}mm;
          height: ${A6_HEIGHT_MM}mm;
          margin: 0; padding: 0; overflow: hidden; background: transparent;
        }
        #print-sheet {
          width: ${A6_WIDTH_MM}mm;
          height: ${A6_HEIGHT_MM}mm;
          position: relative;
          overflow: hidden;
          background: transparent;
        }
        #print-sheet canvas {
          width: ${A6_WIDTH_MM}mm !important;
          height: ${A6_HEIGHT_MM}mm !important;
          display: block;
        }
      `}</style>
      <div
        id="print-sheet"
        style={{ transform: calibrationTransform(cal), transformOrigin: 'center center' }}
      >
        <div ref={host} />
        {missing && (
          <div style={{ padding: 16, fontFamily: 'monospace', fontSize: 12, color: '#0B1220' }}>
            NO TICKET PAYLOAD. Submit a wish in the participant view first.
          </div>
        )}
      </div>
    </>
  );
}
// ALMOST CHOSEN — Static A6 ticket BACK renderer (pre-printed in bulk).
//
// Rendered into a p5.Graphics buffer at 1240 x 1748 px (A6 portrait @ 300 DPI).
// TRANSPARENT background (g.clear()); dark navy ink; NO white ink.
//
// This side is IDENTICAL for every ticket — it contains NO participant data.
// It explains the 100-position system and shows all numbers 00..99 laid out
// sequentially on one complete ring (99 visually reconnects to 00). Outcome
// colours are NOT permanently assigned to individual numbers, because a
// number's outcome depends on its distance from the changing System Draw.

import type { P5Graphics, P5Instance } from './ticket';
import { OUTCOME_BANDS, PALETTE } from './engine';

export const BACK_W = 1240;
export const BACK_H = 1748;

// Debug guides for pre-print alignment. MUST be false in exported output.
const PREPRINT_DEBUG = false;

const INK = {
  navy: '#0B1220',
  navySoft: '#25304A',
  navyFaint: '#5A6480',
} as const;

const CC = {
  LEFT: 'left', RIGHT: 'right', CENTER: 'center',
  TOP: 'top', BOTTOM: 'bottom', BASELINE: 'alphabetic',
  BOLD: 'bold', NORMAL: 'normal',
} as const;

/** Render the static ticket back. No arguments — it never varies per ticket. */
export function renderTicketBack(p5: P5Instance): P5Graphics {
  const g = p5.createGraphics(BACK_W, BACK_H) as P5Graphics;
  g.LEFT = (g.LEFT ?? CC.LEFT) as unknown as number;
  g.RIGHT = (g.RIGHT ?? CC.RIGHT) as unknown as number;
  g.CENTER = (g.CENTER ?? CC.CENTER) as unknown as number;
  g.TOP = (g.TOP ?? CC.TOP) as unknown as number;
  g.BOTTOM = (g.BOTTOM ?? CC.BOTTOM) as unknown as number;
  g.BASELINE = (g.BASELINE ?? CC.BASELINE) as unknown as number;
  g.BOLD = (g.BOLD ?? CC.BOLD) as unknown as number;
  g.NORMAL = (g.NORMAL ?? CC.NORMAL) as unknown as number;

  g.clear();

  const mono = 'Courier New';
  const sans = 'Arial';

  const hexToRgba = (hex: string, a255: number): string => {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) || 0;
    const gg = parseInt(h.slice(2, 4), 16) || 0;
    const b = parseInt(h.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${gg}, ${b}, ${Math.min(1, Math.max(0, a255 / 255))})`;
  };
  const setFill = (c: string, a?: number) => g.fill(a === undefined ? c : hexToRgba(c, a));
  const setStroke = (c: string, a?: number) => g.stroke(a === undefined ? c : hexToRgba(c, a));
  const txt = (
    s: string, x: number, y: number, size: number, color: string,
    align: number = g.LEFT, font: string = mono, style: number = g.BOLD,
    valign: number = g.TOP,
  ): number => {
    g.push();
    g.noStroke();
    setFill(color);
    g.textFont(font);
    g.textStyle(style);
    g.textSize(size);
    g.textAlign(align, valign);
    g.text(s, x, y);
    const w = g.textWidth(s);
    g.pop();
    return w;
  };
  const pad2 = (n: number): string => n.toString().padStart(2, '0');

  const SAFE = { x: 55, y: 55, w: BACK_W - 110, h: BACK_H - 110 };

  // frame
  g.push();
  g.noFill();
  setStroke(INK.navy, 235);
  g.strokeWeight(3);
  g.rect(SAFE.x - 8, SAFE.y - 8, SAFE.w + 16, SAFE.h + 16, 16);
  g.pop();

  // ---- Header ----
  txt('ALMOST CHOSEN SYSTEM', SAFE.x, SAFE.y + 2, 17, INK.navySoft, g.LEFT, mono, g.BOLD);
  txt('THE 100-POSITION WISH SYSTEM', SAFE.x, SAFE.y + 34, 44, INK.navy, g.LEFT, sans, g.BOLD);
  txt('HOW THE DRAW WORKS', SAFE.x, SAFE.y + 88, 22, PALETTE.pink, g.LEFT, mono, g.BOLD);
  g.push();
  setStroke(PALETTE.pink, 160);
  g.strokeWeight(1.5);
  g.line(SAFE.x, SAFE.y + 120, SAFE.x + SAFE.w, SAFE.y + 120);
  g.pop();

  // ---- Circular 00..99 ring (sequential; 99 reconnects to 00) ----
  const ringTop = SAFE.y + 150;
  const ringH = 620;
  const cx = SAFE.x + SAFE.w / 2;
  const cy = ringTop + ringH / 2;
  const R = Math.min(SAFE.w, ringH) / 2 - 40;
  g.push();
  g.noFill();
  setStroke(INK.navyFaint, 170);
  g.strokeWeight(2);
  g.circle(cx, cy, R * 2);
  g.pop();
  // draw all 100 numbers sequentially around the ring
  for (let n = 0; n < 100; n += 1) {
    const a = (-90 + (n / 100) * 360) * (Math.PI / 180);
    const rNum = R - 2;
    const x = cx + Math.cos(a) * rNum;
    const y = cy + Math.sin(a) * rNum;
    // tick
    const x1 = cx + Math.cos(a) * (R + 2);
    const y1 = cy + Math.sin(a) * (R + 2);
    const x2 = cx + Math.cos(a) * (R + (n % 10 === 0 ? 16 : 8));
    const y2 = cy + Math.sin(a) * (R + (n % 10 === 0 ? 16 : 8));
    g.push();
    setStroke(INK.navyFaint, n % 10 === 0 ? 200 : 110);
    g.strokeWeight(n % 10 === 0 ? 2 : 1);
    g.line(x1, y1, x2, y2);
    g.pop();
    // number, rotated to sit tangential-ish but kept upright for legibility
    txt(pad2(n), x, y, n % 10 === 0 ? 17 : 14, n % 10 === 0 ? INK.navy : INK.navySoft, g.CENTER, mono, g.BOLD, g.CENTER);
  }
  // reconnect marker between 99 and 00
  const a0 = (-90) * (Math.PI / 180);
  const rj = R + 30;
  txt('99 → 00', cx + Math.cos(a0) * 0, cy - R - 34, 14, PALETTE.pink, g.CENTER, mono, g.BOLD, g.BOTTOM);
  // centre caption
  txt('ONE CONTINUOUS RING', cx, cy - 14, 15, INK.navySoft, g.CENTER, mono, g.BOLD, g.CENTER);
  txt('OF 100 POSITIONS', cx, cy + 8, 15, INK.navySoft, g.CENTER, mono, g.BOLD, g.CENTER);
  void rj;

  // ---- Steps ----
  const stepsTop = ringTop + ringH + 20;
  const steps = [
    '1. A WISH NUMBER IS ASSIGNED FROM 00 TO 99.',
    '2. A SYSTEM DRAW IS GENERATED FROM 00 TO 99.',
    '3. THE SYSTEM MEASURES BOTH PATHS AROUND THE CIRCLE.',
    '4. THE SHORTER PATH BECOMES THE CIRCULAR DISTANCE.',
    '5. THE DISTANCE DETERMINES THE OUTCOME.',
  ];
  steps.forEach((s, i) => {
    txt(s, SAFE.x, stepsTop + i * 34, 19, INK.navy, g.LEFT, mono, g.BOLD);
  });

  // ---- Distance ranges (four bands) ----
  const rangesTop = stepsTop + steps.length * 34 + 24;
  const rangeText: Record<string, string> = {
    CHOSEN: '0',
    'ALMOST CHOSEN': '01–27',
    REGISTERED: '28–41',
    'NOT THIS TIME': '42–50',
  };
  const cellGap = 16;
  const cellW = (SAFE.w - cellGap * 3) / 4;
  const cellH = 118;
  OUTCOME_BANDS.forEach((band, i) => {
    const bx = SAFE.x + i * (cellW + cellGap);
    g.push();
    g.noFill();
    setStroke(band.accent, 220);
    g.strokeWeight(2);
    g.rect(bx, rangesTop, cellW, cellH, 10);
    g.pop();
    const cxx = bx + cellW / 2;
    txt(rangeText[band.outcome] ?? '', cxx, rangesTop + 16, 26, band.accent, g.CENTER, sans, g.BOLD);
    txt(`${band.percent}%`, cxx, rangesTop + 52, 22, INK.navy, g.CENTER, sans, g.BOLD);
    const nm = band.outcome;
    if (nm.includes(' ')) {
      const parts = nm.split(' ');
      const mid = Math.ceil(parts.length / 2);
      txt(parts.slice(0, mid).join(' '), cxx, rangesTop + 82, 15, INK.navySoft, g.CENTER, mono, g.BOLD);
      txt(parts.slice(mid).join(' '), cxx, rangesTop + 100, 15, INK.navySoft, g.CENTER, mono, g.BOLD);
    } else {
      txt(nm, cxx, rangesTop + 90, 15, INK.navySoft, g.CENTER, mono, g.BOLD);
    }
  });

  // ---- Closing statements ----
  const closeTop = rangesTop + cellH + 30;
  txt('THE SYSTEM DOES NOT READ OR JUDGE THE WISH.', cx, closeTop, 18, INK.navy, g.CENTER, mono, g.BOLD);
  txt('IT ONLY ASSIGNS IT A POSITION.', cx, closeTop + 26, 18, INK.navy, g.CENTER, mono, g.BOLD);
  txt('BEING CHOSEN DOES NOT FULFIL THE WISH.', cx, closeTop + 60, 18, PALETTE.pink, g.CENTER, mono, g.BOLD);

  // ---- Optional pre-print alignment guides (never in exported output) ----
  if (PREPRINT_DEBUG) {
    g.push();
    setStroke('#FF00AA', 200);
    g.strokeWeight(1);
    g.line(BACK_W / 2, 0, BACK_W / 2, BACK_H);
    g.line(0, BACK_H / 2, BACK_W, BACK_H / 2);
    g.noFill();
    g.rect(SAFE.x, SAFE.y, SAFE.w, SAFE.h);
    g.pop();
    txt('TOP EDGE', BACK_W / 2, 12, 14, '#FF00AA', g.CENTER, mono, g.BOLD);
    txt('FEED EDGE', BACK_W / 2, BACK_H - 26, 14, '#FF00AA', g.CENTER, mono, g.BOLD);
    txt('BACK · ORIENTATION GUIDE', SAFE.x + 8, SAFE.y + 8, 12, '#FF00AA', g.LEFT, mono, g.BOLD);
  }

  return g;
}
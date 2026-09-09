// ALMOST CHOSEN — A6 Portrait Wish Lottery Ticket FRONT renderer (transparent).
//
// Renders into a p5.Graphics buffer at 1240 x 1748 px (A6 portrait @ 300 DPI).
//
// PRINT MODEL: genuinely TRANSPARENT — g.clear() and NO full-page background /
// rect / paper layer is ever drawn. The physical coloured paper is the
// background. Dark navy ink (#0B1220) is used for legibility; NEVER white ink.
//
// This build renders a compact, logical SELECTION MATRIX (5x5) instead of a
// large circular map. Every cell is a real ring position derived from the
// SYSTEM DRAW, coloured by the outcome band its own circular distance falls
// in, with the real Wish Number and System Draw injected and highlighted. A
// side panel spells out the calculation (Wish, System, raw difference,
// circular distance, outcome range, final outcome). No random numbers remain.
//
// Global print centring/scale is applied by the /print page as ONE CSS
// transform (see ticketRecord.calibrationTransform). The renderer itself never
// moves individual modules for printer correction.

import type { DrawResult, Outcome } from './engine';
import {
  NUMBER_MODULUS,
  OUTCOME_BANDS,
  OUTCOME_EXPLANATION_LINES,
  PALETTE,
  accentFor,
  bandForDistance,
  categoryAccentFor,
  formatDate,
  formatTime,
  outcomeRangeLabel,
} from './engine';

export const TICKET_W = 1240;
export const TICKET_H = 1748;

const DEBUG_LAYOUT = false;
const SAFE_X = 55;
const SAFE_W = TICKET_W - SAFE_X * 2;
const HEADER_BLOCK = 34;

const TICKET_LAYOUT = {
  safe: { x: SAFE_X, y: 55, w: SAFE_W, h: TICKET_H - 55 * 2 },
  header: { x: SAFE_X, y: 55, w: SAFE_W, h: 115 },
  record: { x: SAFE_X, y: 185, w: SAFE_W, h: 150 },
  wish: { x: SAFE_X, y: 350, w: SAFE_W, h: 186 },
  tokens: { x: SAFE_X, y: 575, w: SAFE_W, h: 140 },
  drawmap: { x: SAFE_X, y: 730, w: SAFE_W, h: 430 },
  result: { x: SAFE_X, y: 1175, w: SAFE_W, h: 155 },
  probability: { x: SAFE_X, y: 1345, w: SAFE_W, h: 130 },
  footer: { x: SAFE_X, y: 1490, w: SAFE_W, h: 185 },
} as const;

const INK = {
  navy: '#0B1220',
  navySoft: '#25304A',
  navyFaint: '#5A6480',
} as const;

interface Box { x: number; y: number; w: number; h: number; }

export interface P5Graphics {
  width: number; height: number; clear: () => void; background: (c: string) => void;
  noFill: () => void; fill: (c: string) => void; noStroke: () => void; stroke: (c: string) => void;
  strokeWeight: (w: number) => void; strokeCap: (c: number) => void;
  rect: (x: number, y: number, w: number, h: number, r?: number) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  ellipse: (x: number, y: number, w: number, h: number) => void;
  circle: (x: number, y: number, d: number) => void; point: (x: number, y: number) => void;
  arc: (x: number, y: number, w: number, h: number, start: number, stop: number) => void;
  triangle: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => void;
  push: () => void; pop: () => void; translate: (x: number, y: number) => void; rotate: (a: number) => void;
  textAlign: (h: number, v?: number) => void; textSize: (s: number) => void; textStyle: (s: number) => void;
  textFont: (f: string) => void; textWidth: (s: string) => number; text: (s: string, x: number, y: number) => void;
  textLeading: (n: number) => void; textAscent: () => number; textDescent: () => number;
  drawingContext: CanvasRenderingContext2D;
  LEFT: number; RIGHT: number; CENTER: number; TOP: number; BOTTOM: number; BASELINE: number;
  BOLD: number; NORMAL: number; ITALIC: number; ROUND: number; PROJECT: number; SQUARE: number;
  TWO_PI: number; HALF_PI: number; PI: number;
}

export interface P5Instance { createGraphics: (w: number, h: number) => P5Graphics; }

const C = {
  LEFT: 'left', RIGHT: 'right', CENTER: 'center', TOP: 'top', BOTTOM: 'bottom', BASELINE: 'alphabetic',
  BOLD: 'bold', NORMAL: 'normal', ITALIC: 'italic', ROUND: 'round', PROJECT: 'square', SQUARE: 'butt',
  TWO_PI: Math.PI * 2, HALF_PI: Math.PI / 2, PI: Math.PI,
} as const;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function renderTicket(p5: P5Instance, draw: DrawResult, wishText: string): P5Graphics {
  const g = p5.createGraphics(TICKET_W, TICKET_H) as P5Graphics;
  g.LEFT = (g.LEFT ?? C.LEFT) as unknown as number; g.RIGHT = (g.RIGHT ?? C.RIGHT) as unknown as number;
  g.CENTER = (g.CENTER ?? C.CENTER) as unknown as number; g.TOP = (g.TOP ?? C.TOP) as unknown as number;
  g.BOTTOM = (g.BOTTOM ?? C.BOTTOM) as unknown as number; g.BASELINE = (g.BASELINE ?? C.BASELINE) as unknown as number;
  g.BOLD = (g.BOLD ?? C.BOLD) as unknown as number; g.NORMAL = (g.NORMAL ?? C.NORMAL) as unknown as number;
  g.ITALIC = (g.ITALIC ?? C.ITALIC) as unknown as number; g.ROUND = (g.ROUND ?? C.ROUND) as unknown as number;
  g.PROJECT = (g.PROJECT ?? C.PROJECT) as unknown as number; g.SQUARE = (g.SQUARE ?? C.SQUARE) as unknown as number;
  g.TWO_PI = (g.TWO_PI ?? C.TWO_PI) as number; g.HALF_PI = (g.HALF_PI ?? C.HALF_PI) as number; g.PI = (g.PI ?? C.PI) as number;
  g.clear();

  const categoryColor = categoryAccentFor(draw.category); const outcomeColor = accentFor(draw.outcome); const systemInk = INK.navy;
  const mono = 'Courier New'; const sans = 'Arial';
  const hexToRgba = (hex: string, a255: number): string => {
    let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) || 0; const gg = parseInt(h.slice(2, 4), 16) || 0; const b = parseInt(h.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${gg}, ${b}, ${Math.min(1, Math.max(0, a255 / 255))})`;
  };
  const setFill = (c: string, a?: number) => g.fill(a === undefined ? c : hexToRgba(c, a));
  const setStroke = (c: string, a?: number) => g.stroke(a === undefined ? c : hexToRgba(c, a));
  const measure = (s: string, size: number, font: string, style: number): number => { g.push(); g.textFont(font); g.textStyle(style); g.textSize(size); const w = g.textWidth(s); g.pop(); return w; };
  const txt = (s: string, x: number, y: number, size: number, color: string, align: number = g.LEFT, font: string = mono, style: number = g.BOLD, valign: number = g.TOP): number => {
    g.push(); g.noStroke(); setFill(color); g.textFont(font); g.textStyle(style); g.textSize(size); g.textAlign(align, valign); g.text(s, x, y); const w = g.textWidth(s); g.pop(); return w;
  };
  const wrapTextToBox = (s: string, maxWidth: number, size: number, font: string, style: number): string[] => {
    const words = s.split(/\s+/).filter(Boolean); const lines: string[] = []; let cur = '';
    for (const word of words) { const test = cur ? `${cur} ${word}` : word; if (measure(test, size, font, style) > maxWidth && cur) { lines.push(cur); cur = word; } else { cur = test; } }
    if (cur) lines.push(cur); return lines;
  };
  const fitWrappedText = (s: string, maxWidth: number, maxLines: number, preferred: number, minimum: number, font: string, style: number) => {
    for (let size = preferred; size >= minimum; size -= 1) { const lines = wrapTextToBox(s, maxWidth, size, font, style); if (lines.length <= maxLines) return { size, lines }; }
    const lines = wrapTextToBox(s, maxWidth, minimum, font, style).slice(0, maxLines); return { size: minimum, lines };
  };
  const fitTextToWidth = (s: string, maxWidth: number, preferred: number, minimum: number, font: string, style: number): number => { let size = preferred; while (size > minimum && measure(s, size, font, style) > maxWidth) size -= 1; return size; };
  const drawLabelValue = (label: string, value: string, x: number, y: number, w: number, labelColor: string, valueColor: string, labelSize = 20, valueMax = 30, valueMin = 22, valueFont = mono): void => {
    txt(label, x, y, labelSize, labelColor, g.LEFT, mono, g.BOLD); const vSize = fitTextToWidth(value, w, valueMax, valueMin, valueFont, g.BOLD); txt(value, x, y + labelSize + 8, vSize, valueColor, g.LEFT, valueFont, g.BOLD);
  };
  const debugBoxes: Array<{ name: string; box: Box }> = [];
  const assertInsideBounds = (_name: string, _box: Box, _within: Box) => {};
  const assertNoOverlap = (name: string, box: Box) => { if (DEBUG_LAYOUT) debugBoxes.push({ name, box }); };
  const drawDebugFrame = (_name: string, _box: Box, _color: string) => {};
  const moduleHeader = (label: string, box: Box, color: string, size = 19): number => {
    const y = box.y; g.push(); setStroke(color, 235); g.strokeWeight(4); g.line(box.x, y + size / 2 + 2, box.x + 26, y + size / 2 + 2); g.pop();
    const lx = box.x + 38; const w = txt(label, lx, y, size, color, g.LEFT, mono, g.BOLD); g.push(); setStroke(INK.navyFaint, 120); g.strokeWeight(1.5); g.line(lx + w + 22, y + size / 2 + 2, box.x + box.w, y + size / 2 + 2); g.pop(); return HEADER_BLOCK;
  };
  const pad2 = (n: number): string => n.toString().padStart(2, '0');

  const F = TICKET_LAYOUT.safe;
  g.push(); g.noFill(); setStroke(INK.navy, 235); g.strokeWeight(3); g.rect(F.x - 8, F.y - 8, F.w + 16, F.h + 16, 16); setStroke(categoryColor, 210); g.strokeWeight(1.5); g.rect(F.x - 2, F.y - 2, F.w + 4, F.h + 4, 12); g.pop();

  drawHeader(); drawRecord(); drawWishAndProtocol(); drawTokens(); drawSelectionMatrix(); drawResult(); drawProbabilityNotice(); drawFooter();
  if (DEBUG_LAYOUT) { assertInsideBounds('safe', F, F); drawDebugFrame('SAFE', F, INK.navyFaint); }
  return g;

  function drawHeader(): void {
    const b = TICKET_LAYOUT.header; assertNoOverlap('header', b); txt('ALMOST CHOSEN SYSTEM', b.x + 6, b.y + 18, 17, INK.navySoft, g.LEFT, mono, g.BOLD);
    const tagText = `CATEGORY · ${draw.category}`; const tagPadX = 18; const tagSize = 22; const tagTextW = measure(tagText, tagSize, mono, g.BOLD); const tagW = tagTextW + tagPadX * 2; const tagH = 46;
    const tagX = b.x + b.w - tagW - 20; const tagY = b.y + 40; const titleMaxW = tagX - b.x - 30; const titleSize = fitTextToWidth('WISH LOTTERY TICKET', titleMaxW, 56, 40, sans, g.BOLD);
    txt('WISH LOTTERY TICKET', b.x + 6, b.y + 60, titleSize, INK.navy, g.LEFT, sans, g.BOLD); g.push(); g.noFill(); setStroke(categoryColor, 240); g.strokeWeight(2.5); g.rect(tagX, tagY, tagW, tagH, tagH / 2); g.pop(); txt(tagText, tagX + tagW / 2, tagY + tagH / 2, tagSize, categoryColor, g.CENTER, mono, g.BOLD, g.CENTER);
    g.push(); setStroke(categoryColor, 150); g.strokeWeight(1.5); g.line(b.x, b.y + b.h, b.x + b.w, b.y + b.h); g.pop();
  }

  function drawRecord(): void {
    const b = TICKET_LAYOUT.record; assertNoOverlap('record', b); moduleHeader('RECORD INFORMATION', b, categoryColor); const gridTop = b.y + HEADER_BLOCK + 8; const gridH = b.h - HEADER_BLOCK - 8; const colGap = 40; const colW = (b.w - colGap) / 2; const rowH = gridH / 2;
    const fields = [{ label: 'TICKET ID', value: draw.ticketId }, { label: 'ARCHIVE CODE', value: draw.archiveCode }, { label: 'DRAW DATE', value: formatDate(draw.drawnAt) }, { label: 'DRAW TIME', value: `${formatTime(draw.drawnAt)} ${draw.timezone}` }];
    fields.forEach((f, i) => { const col = i % 2; const row = Math.floor(i / 2); drawLabelValue(f.label, f.value, b.x + col * (colW + colGap), gridTop + row * rowH, colW - 6, INK.navySoft, INK.navy); });
  }

  function drawWishAndProtocol(): void {
    const b = TICKET_LAYOUT.wish; assertNoOverlap('wish', b); const colGap = 30; const leftW = Math.round((b.w - colGap) * 0.6); const rightW = b.w - colGap - leftW; const leftX = b.x; const rightX = b.x + leftW + colGap;
    const noteH = 34; const boxTop = b.y + HEADER_BLOCK + 6; const boxH = b.y + b.h - boxTop - noteH;
    moduleHeader('WISH SUBMITTED', { ...b, w: leftW }, PALETTE.blue); g.push(); setFill(categoryColor); g.noStroke(); g.rect(leftX, boxTop, 8, boxH, 3); g.pop();
    const textX = leftX + 30; const textW = leftW - 30; const safeWish = (wishText || '').trim() || '—'; const { size, lines } = fitWrappedText(safeWish, textW, 4, 30, 22, sans, g.NORMAL); const leading = Math.round(size * 1.3); const startY = boxTop + Math.max(0, (boxH - lines.length * leading) / 2); lines.forEach((ln, i) => txt(ln, textX, startY + i * leading, size, INK.navy, g.LEFT, sans, g.NORMAL));
    moduleHeader('WISH PROTOCOL', { ...b, x: rightX, w: rightW }, PALETTE.violet); g.push(); g.noFill(); setStroke(INK.navyFaint, 150); g.strokeWeight(1.5); g.rect(rightX, boxTop, rightW, boxH, 8); g.pop();
    const rows = [{ label: 'CATEGORY', value: draw.category, color: categoryColor }, { label: 'VISIBILITY', value: 'TICKET ONLY', color: INK.navy }, { label: 'PUBLIC DISPLAY', value: 'ID / RESULT / TIME', color: INK.navy }]; const rowGap = boxH / rows.length;
    rows.forEach((r, i) => { const ry = boxTop + i * rowGap + 4; txt(r.label, rightX + 18, ry, 14, INK.navySoft); txt(r.value, rightX + 18, ry + 20, fitTextToWidth(r.value, rightW - 36, 20, 14, mono, g.BOLD), r.color); });
    txt('THE SYSTEM DOES NOT READ OR JUDGE THE WISH.', b.x, boxTop + boxH + 8, 13, INK.navyFaint); txt('IT ONLY ASSIGNS IT A POSITION.', b.x, boxTop + boxH + 24, 13, INK.navyFaint);
  }

  function drawTokens(): void {
    const b = TICKET_LAYOUT.tokens; assertNoOverlap('tokens', b); moduleHeader('SYSTEM RECORD TOKENS', b, categoryColor); const gridTop = b.y + HEADER_BLOCK + 4; const gapX = 16; const cellW = (b.w - gapX * 3) / 4; const cellH = 88;
    const tokens = [{ label: 'WISH NUMBER', value: pad2(draw.wishNumber), color: categoryColor }, { label: 'SYSTEM DRAW', value: pad2(draw.systemNumber), color: systemInk }, { label: 'DIRECT DIFFERENCE', value: String(draw.directDifference), color: INK.navy }, { label: 'CIRCULAR DISTANCE', value: String(draw.distance), color: outcomeColor }];
    tokens.forEach((t, i) => { const cx = b.x + i * (cellW + gapX); g.push(); g.noFill(); setStroke(t.color, 210); g.strokeWeight(1.8); g.rect(cx, gridTop, cellW, cellH, 10); g.pop(); txt(t.label, cx + 15, gridTop + 22, fitTextToWidth(t.label, cellW - 28, 17, 12, mono, g.BOLD), INK.navySoft); txt(t.value, cx + 15, gridTop + 45, fitTextToWidth(t.value, cellW - 28, 38, 26, sans, g.BOLD), t.color, g.LEFT, sans); });
  }

  function drawSelectionMatrix(): void {
    const b = TICKET_LAYOUT.drawmap; assertNoOverlap('drawmap', b); moduleHeader('SELECTION MATRIX', b, PALETTE.pink); const contentTop = b.y + HEADER_BLOCK + 8; const zoneH = b.y + b.h - contentTop; const colGap = 28; const matrixW = Math.round((b.w - colGap) * 0.5); const calcW = b.w - colGap - matrixW; const calcX = b.x + matrixW + colGap;
    const wrap = (n: number) => ((n % NUMBER_MODULUS) + NUMBER_MODULUS) % NUMBER_MODULUS; const circDist = (a: number, n: number) => { const d = Math.abs(a - n); return Math.min(d, NUMBER_MODULUS - d); };
    const cells = [-2, -1, 0, 1, 2].map((rs) => [-2, -1, 0, 1, 2].map((cs) => wrap(draw.systemNumber + rs * 11 + cs))); if (!cells.some((row) => row.includes(draw.wishNumber))) cells[0][0] = draw.wishNumber;
    const grid = Math.min(matrixW, zoneH - 26); const cell = Math.floor(grid / 5); const gridSize = cell * 5; const gx = b.x + Math.max(0, (matrixW - gridSize) / 2); const gy = contentTop + Math.max(0, (zoneH - 26 - gridSize) / 2);
    for (let r = 0; r < 5; r += 1) for (let c = 0; c < 5; c += 1) { const value = cells[r][c]; const x = gx + c * cell; const y = gy + r * cell; const zone = accentFor(bandForDistance(circDist(value, draw.systemNumber)).outcome); const isWish = value === draw.wishNumber; const isSystem = value === draw.systemNumber;
      g.push(); g.noFill(); setStroke(zone, isWish || isSystem ? 245 : 120); g.strokeWeight(isWish || isSystem ? 3 : 1.2); g.rect(x + 3, y + 3, cell - 6, cell - 6, 6); g.pop(); txt(pad2(value), x + cell / 2, y + cell / 2, isWish || isSystem ? 26 : 20, isWish ? categoryColor : isSystem ? systemInk : INK.navySoft, g.CENTER, sans, g.BOLD, g.CENTER); }
    g.push(); g.noFill(); setStroke(INK.navyFaint, 130); g.strokeWeight(1.5); g.rect(calcX, contentTop, calcW, zoneH, 10); g.pop();
    const rows = [{ label: 'WISH NUMBER', value: pad2(draw.wishNumber), color: categoryColor }, { label: 'SYSTEM DRAW', value: pad2(draw.systemNumber), color: systemInk }, { label: 'RAW DIFFERENCE', value: `|${pad2(draw.wishNumber)}-${pad2(draw.systemNumber)}| = ${draw.directDifference}`, color: INK.navy }, { label: 'CIRCULAR DISTANCE', value: `min(${draw.directDifference}, ${draw.wrapAroundDistance}) = ${draw.distance}`, color: outcomeColor }, { label: 'OUTCOME RANGE', value: outcomeRangeLabel(draw.distance), color: outcomeColor }, { label: 'FINAL OUTCOME', value: draw.outcome, color: outcomeColor }];
    const rowGap = (zoneH - 36) / rows.length; rows.forEach((r, i) => { const ry = contentTop + 18 + i * rowGap; txt(r.label, calcX + 18, ry, 15, INK.navySoft); txt(r.value, calcX + 18, ry + 18, fitTextToWidth(r.value, calcW - 36, 22, 13, sans, g.BOLD), r.color, g.LEFT, sans); });
  }

  function drawResult(): void {
    const b = TICKET_LAYOUT.result; assertNoOverlap('result', b); g.push(); g.noFill(); setStroke(outcomeColor, 240); g.strokeWeight(draw.outcome === 'ALMOST CHOSEN' ? 4 : 2.5); g.rect(b.x, b.y, b.w, b.h, 12); g.pop();
    txt('RESULT / STATUS', b.x + 62, b.y + 26, 20, INK.navySoft); txt(draw.outcome, b.x + 62, b.y + 54, fitTextToWidth(draw.outcome, b.w - 260, 46, 30, sans, g.BOLD), outcomeColor, g.LEFT, sans);
    txt('RANGE', b.x + b.w - 28, b.y + 24, 13, INK.navySoft, g.RIGHT); txt(outcomeRangeLabel(draw.distance), b.x + b.w - 28, b.y + 44, 24, outcomeColor, g.RIGHT, sans);
    const explLines = OUTCOME_EXPLANATION_LINES[draw.outcome]; explLines.forEach((l, i) => txt(l, b.x + 28, b.y + 112 + i * 20, 15, INK.navy));
  }

  function drawProbabilityNotice(): void {
    const b = TICKET_LAYOUT.probability; assertNoOverlap('probability', b); const headerH = moduleHeader('PROBABILITY NOTICE', b, PALETTE.cyan); const cellsTop = b.y + headerH + 4; const cellH = b.h - headerH - 4; const gap = 8; const cellW = (b.w - gap * 3) / 4;
    OUTCOME_BANDS.forEach((band, i) => { const cx = b.x + i * (cellW + gap); const isThis = band.outcome === draw.outcome; g.push(); g.noFill(); setStroke(isThis ? band.accent : INK.navyFaint, isThis ? 245 : 120); g.strokeWeight(isThis ? 2.5 : 1.5); g.rect(cx, cellsTop, cellW, cellH, 8); g.pop(); const centerX = cx + cellW / 2; txt(`${band.percent}%`, centerX, cellsTop + cellH * 0.48, 30, isThis ? band.accent : INK.navy, g.CENTER, sans, g.BOLD, g.CENTER); txt(band.outcome, centerX, cellsTop + cellH * 0.76, fitTextToWidth(band.outcome, cellW - 18, 18, 11, mono, g.BOLD), isThis ? band.accent : INK.navySoft, g.CENTER, mono, g.BOLD, g.CENTER); });
  }

  function drawFooter(): void {
    const b = TICKET_LAYOUT.footer; assertNoOverlap('footer', b); g.push(); setStroke(INK.navyFaint, 150); g.strokeWeight(1.5); g.line(b.x, b.y, b.x + b.w, b.y); g.pop();
    const qrSize = 104; const qrX = b.x + 28; const qrY = b.y + 35; g.push(); g.noFill(); setStroke(INK.navy, 220); g.strokeWeight(2); g.rect(qrX, qrY, qrSize, qrSize, 4); const modules = 11; const m = qrSize / modules; setFill(INK.navy); g.noStroke(); const qrRng = mulberry32((draw.matrixSeed ^ 0x51ed270b) >>> 0); for (let r = 0; r < modules; r++) for (let c = 0; c < modules; c++) if (qrRng() < 0.5) g.rect(qrX + c * m + 2, qrY + r * m + 2, m - 2, m - 2); g.pop();
    const midX = b.x + b.w / 2; txt('THE WISH REMAINS PRIVATE.', midX, b.y + 48, 17, INK.navy, g.CENTER); txt('ONLY TICKET ID, RESULT AND TIME ENTER THE PUBLIC DISPLAY.', midX, b.y + 78, 14, INK.navySoft, g.CENTER); txt('BEING CHOSEN DOES NOT FULFIL THE WISH.', midX, b.y + 108, 14, INK.navySoft, g.CENTER);
    const bcX = b.x + b.w - 300; const bcY = b.y + 50; g.push(); g.noFill(); setStroke(INK.navy, 200); g.strokeWeight(1.5); g.rect(bcX, bcY, 260, 68, 3); const digits = draw.ticketId.replace(/\D/g, ''); let bx = bcX + 12; let di = 0; setFill(INK.navy); g.noStroke(); while (bx < bcX + 248) { const d = digits.length ? parseInt(digits[di % digits.length], 10) : di; const w = 3 + (d % 3) * 2; if ((d + di) % 2 === 0) g.rect(bx, bcY + 8, w, 52); bx += w + 4; di += 1; } g.pop(); txt(draw.ticketId, bcX + 130, bcY + 82, 14, INK.navy, g.CENTER);
  }
}

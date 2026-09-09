// ALMOST CHOSEN — Shared Probability & Distance Engine
// ONE config + ONE real numerical mechanism drives:
//   - the actual outcome
//   - the percentages printed on the ticket
//   - the percentages shown on the projection
//   - archive statistics
//   - the four-stage participant animation
//   - the automatic (Electron) / fallback (Web) print job
// No independent or decorative random result system may exist elsewhere.
//
// TERMINOLOGY: the four final outcomes are CHOSEN / ALMOST CHOSEN /
// REGISTERED / NOT THIS TIME. "ARCHIVED" is retired and must not appear.

export type Outcome = 'CHOSEN' | 'ALMOST CHOSEN' | 'REGISTERED' | 'NOT THIS TIME';

export type Category =
  | 'LOVE'
  | 'FUTURE'
  | 'HEALING'
  | 'CONNECTION'
  | 'FREEDOM'
  | 'IDENTITY'
  | 'OTHER';

export const CATEGORIES: Category[] = [
  'LOVE',
  'FUTURE',
  'HEALING',
  'CONNECTION',
  'FREEDOM',
  'IDENTITY',
  'OTHER',
];

// Categories that are surfaced on the public projection distribution.
// OTHER is intentionally not projected as its own labelled band.
export const PROJECTED_CATEGORIES: Category[] = [
  'LOVE',
  'FUTURE',
  'HEALING',
  'CONNECTION',
  'FREEDOM',
  'IDENTITY',
];

// The numbers run 00..99 on a ring of size 100. The maximum circular
// distance between two points on a ring of 100 is 50.
export const NUMBER_MODULUS = 100;
export const MAX_DISTANCE = NUMBER_MODULUS / 2; // 50

// Distance bands. These are the SINGLE source of truth for outcome and odds.
//   distance 0            -> CHOSEN          -> 1%
//   distance 1..27        -> ALMOST CHOSEN   -> 54%
//   distance 28..41       -> REGISTERED      -> 28%
//   distance 42..50       -> NOT THIS TIME   -> 17%
export interface OutcomeBand {
  outcome: Outcome;
  minDistance: number;
  maxDistance: number;
  percent: number;
  accent: string; // hex accent used across ticket + projection
}

export const OUTCOME_BANDS: OutcomeBand[] = [
  { outcome: 'CHOSEN', minDistance: 0, maxDistance: 0, percent: 1, accent: '#FFD21E' },
  { outcome: 'ALMOST CHOSEN', minDistance: 1, maxDistance: 27, percent: 54, accent: '#FF2E92' },
  { outcome: 'REGISTERED', minDistance: 28, maxDistance: 41, percent: 28, accent: '#26E0E0' },
  { outcome: 'NOT THIS TIME', minDistance: 42, maxDistance: 50, percent: 17, accent: '#2E7BFF' },
];

export const OUTCOMES: Outcome[] = OUTCOME_BANDS.map((b) => b.outcome);

// Fixed participant-facing explanations for each outcome (exact wording).
export const OUTCOME_EXPLANATION: Record<Outcome, string> = {
  CHOSEN: 'YOUR WISH OCCUPIED THE SELECTED POSITION.',
  'ALMOST CHOSEN': 'YOUR WISH CAME VERY CLOSE TO SELECTION.',
  REGISTERED:
    'YOUR WISH WAS RECORDED BY THE SYSTEM, BUT IT WAS NOT SELECTED IN THIS DRAW.',
  'NOT THIS TIME':
    'YOUR WISH FELL OUTSIDE THE ACTIVE RANGE. ANOTHER DRAW MAY PRODUCE A DIFFERENT RESULT.',
};

/** Two-line explanation (as authored) split for tickets / screens that stack. */
export const OUTCOME_EXPLANATION_LINES: Record<Outcome, string[]> = {
  CHOSEN: ['YOUR WISH OCCUPIED THE SELECTED POSITION.'],
  'ALMOST CHOSEN': ['YOUR WISH CAME VERY CLOSE TO SELECTION.'],
  REGISTERED: [
    'YOUR WISH WAS RECORDED BY THE SYSTEM,',
    'BUT IT WAS NOT SELECTED IN THIS DRAW.',
  ],
  'NOT THIS TIME': [
    'YOUR WISH FELL OUTSIDE THE ACTIVE RANGE.',
    'ANOTHER DRAW MAY PRODUCE A DIFFERENT RESULT.',
  ],
};

export const PALETTE = {
  black: '#000000',
  ink: '#050507',
  white: '#F4F4F6',
  pink: '#FF2E92',
  blue: '#2E7BFF',
  yellow: '#FFD21E',
  orange: '#FF6A2B',
  cyan: '#26E0E0',
  violet: '#B36BFF',
  dim: '#5A5A66',
} as const;

// Category-based accent color system — SINGLE source of truth for the theme
// color of each category across input, ticket and projection.
export const CATEGORY_ACCENT: Record<Category, string> = {
  LOVE: PALETTE.pink,
  FUTURE: PALETTE.blue,
  HEALING: PALETTE.cyan,
  CONNECTION: PALETTE.orange,
  FREEDOM: PALETTE.yellow,
  IDENTITY: PALETTE.violet,
  OTHER: PALETTE.white,
};

/** Theme accent color for a category — shared by input, ticket, projection. */
export function categoryAccentFor(category: Category): string {
  return CATEGORY_ACCENT[category] ?? PALETTE.white;
}

/** Percentage published for an outcome — read from the shared band config. */
export function percentFor(outcome: Outcome): number {
  return OUTCOME_BANDS.find((b) => b.outcome === outcome)!.percent;
}

/** Accent color for an outcome — shared by ticket and projection. */
export function accentFor(outcome: Outcome): string {
  return OUTCOME_BANDS.find((b) => b.outcome === outcome)!.accent;
}

// ---- The exact shared draw arithmetic (visualised on ticket + animation) ----

/** |a - b| on the 00..99 line. */
export function directDifferenceOf(a: number, b: number): number {
  return Math.abs(a - b);
}

/** The other way around the ring of 100. */
export function wrapAroundOf(directDifference: number): number {
  return NUMBER_MODULUS - directDifference;
}

/** Circular distance on a ring of NUMBER_MODULUS points. Range 0..MAX_DISTANCE. */
export function circularDistance(a: number, b: number): number {
  const direct = directDifferenceOf(a, b) % NUMBER_MODULUS;
  return Math.min(direct, NUMBER_MODULUS - direct);
}

/** Map a circular distance to its outcome band. */
export function outcomeForDistance(distance: number): Outcome {
  for (const band of OUTCOME_BANDS) {
    if (distance >= band.minDistance && distance <= band.maxDistance) {
      return band.outcome;
    }
  }
  return OUTCOME_BANDS[OUTCOME_BANDS.length - 1].outcome;
}

/** The band object for a given distance (its min/max define the OUTCOME RANGE). */
export function bandForDistance(distance: number): OutcomeBand {
  for (const band of OUTCOME_BANDS) {
    if (distance >= band.minDistance && distance <= band.maxDistance) return band;
  }
  return OUTCOME_BANDS[OUTCOME_BANDS.length - 1];
}

/** The band object for a given outcome. */
export function bandForOutcome(outcome: Outcome): OutcomeBand {
  return OUTCOME_BANDS.find((b) => b.outcome === outcome)!;
}

/**
 * Human-readable OUTCOME RANGE label for the distance band a draw landed in,
 * e.g. distance 12 (ALMOST CHOSEN, band 1..27) -> "01–27".
 */
export function outcomeRangeLabel(distance: number): string {
  const band = bandForDistance(distance);
  const lo = band.minDistance.toString().padStart(2, '0');
  const hi = band.maxDistance.toString().padStart(2, '0');
  return lo === hi ? lo : `${lo}–${hi}`;
}

export interface DrawResult {
  ticketId: string; // AC-####-####-####
  archiveCode: string; // e.g. 540·13H·32M archive stamp
  category: Category;
  wishNumber: number; // 00..99
  systemNumber: number; // 00..99 (SYSTEM DRAW)
  directDifference: number; // |wish - system|  (0..99)
  wrapAroundDistance: number; // 100 - directDifference (1..100)
  distance: number; // circular distance 0..50 (min of the two paths)
  outcome: Outcome;
  drawnAt: number; // epoch ms — when the draw RESULT was decided
  generatedAt: number; // epoch ms — when the TICKET was generated/rendered
  timezone: string; // e.g. "GMT+8"
  matrixSeed: number; // deterministic seed for decorative geometry (QR/barcode)
  isTest?: boolean; // ADMIN-only: preview/test draws. Never true in production flow.
}

function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function group4(): string {
  return randInt(10000).toString().padStart(4, '0');
}

/** Ticket ID in the form AC-####-####-####. */
export function generateTicketId(): string {
  return `AC-${group4()}-${group4()}-${group4()}`;
}

/** Compact archive stamp reminiscent of the reference ticket (e.g. 540·13H·32M). */
export function generateArchiveCode(): string {
  const a = randInt(1000).toString().padStart(3, '0');
  const h = randInt(24).toString().padStart(2, '0');
  const m = randInt(100).toString().padStart(2, '0');
  return `${a}·${h}H·${m}M`;
}

function localTimezoneLabel(date: Date): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return mm === 0 ? `GMT${sign}${hh}` : `GMT${sign}${hh}:${pad2(mm)}`;
}

function buildResult(
  category: Category,
  wishNumber: number,
  systemNumber: number,
  isTest = false,
): DrawResult {
  const directDifference = directDifferenceOf(wishNumber, systemNumber);
  const wrapAroundDistance = wrapAroundOf(directDifference);
  const distance = Math.min(directDifference, wrapAroundDistance);
  const outcome = outcomeForDistance(distance);
  const now = new Date();
  const t = now.getTime();
  return {
    ticketId: generateTicketId(),
    archiveCode: generateArchiveCode(),
    category,
    wishNumber,
    systemNumber,
    directDifference,
    wrapAroundDistance,
    distance,
    outcome,
    drawnAt: t,
    generatedAt: t,
    timezone: localTimezoneLabel(now),
    matrixSeed: randInt(1_000_000),
    ...(isTest ? { isTest: true } : {}),
  };
}

/**
 * Perform one real, immutable draw. The wish text and the selected category
 * NEVER affect the numbers — the system only assigns a position. Percentages
 * everywhere are read from OUTCOME_BANDS, so display and mechanism can never
 * diverge.
 */
export function performDraw(category: Category): DrawResult {
  const wishNumber = randInt(NUMBER_MODULUS);
  const systemNumber = randInt(NUMBER_MODULUS);
  return buildResult(category, wishNumber, systemNumber);
}

/**
 * Deterministically construct a draw whose real distance lands the given
 * outcome band. Used by the FORCE_RESULT test variable and admin previews.
 * Runs the SAME distance mechanism — it only fixes the numbers so the circular
 * distance falls inside the desired band. No parallel result system.
 */
export function performForcedDraw(
  category: Category,
  forced: Outcome,
  isTest = false,
): DrawResult {
  const band = OUTCOME_BANDS.find((b) => b.outcome === forced);
  if (!band) return performDraw(category);
  const span = band.maxDistance - band.minDistance;
  const targetDistance = band.minDistance + (span > 0 ? randInt(span + 1) : 0);
  const wishNumber = randInt(NUMBER_MODULUS);
  const systemNumber = (wishNumber + targetDistance) % NUMBER_MODULUS;
  return buildResult(category, wishNumber, systemNumber, isTest);
}

/**
 * Deterministically construct a logically valid CHOSEN draw for ADMIN preview
 * or full test flow. CHOSEN requires the wish to occupy the SELECTED position:
 *   wishNumber === systemNumber -> directDifference 0, wrapAround 100,
 *   circularDistance 0, outcomeRange "0", outcome CHOSEN.
 * The shared number is picked at random from 00..99 but both values are always
 * identical, so the SAME distance mechanism produces distance 0 (never a
 * parallel result system). Production probabilities are NOT touched.
 */
export function performChosenPreview(category: Category, isTest = false): DrawResult {
  const shared = randInt(NUMBER_MODULUS);
  return buildResult(category, shared, shared, isTest);
}

// ---- Formatting helpers shared by ticket + projection ----

export function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  const months = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ];
  return `${months[d.getMonth()]} ${pad2(d.getDate())}, ${d.getFullYear()}`;
}

export function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function formatNumber(n: number): string {
  return pad2(n);
}

export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  const months = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ];
  const date = `${pad2(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return `${date} · ${time}`;
}
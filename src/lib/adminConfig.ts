// ALMOST CHOSEN — Test & Admin configuration.
//
// FORCE_RESULT lets an operator preview all four states without relying on
// chance. When set to an outcome, the participant draw uses performForcedDraw
// (same distance mechanism, fixed numbers) instead of a pure random draw.
// It is null by default so production behaviour is untouched.

import type { Outcome } from './engine';

const FORCE_KEY = 'almost-chosen/force-result/v1';

/**
 * Default FORCE_RESULT. Change this constant to one of the four outcomes to
 * hard-force every draw at build time, or drive it at runtime from the hidden
 * admin panel (which persists to localStorage and overrides this default).
 */
export const FORCE_RESULT: Outcome | null = null;

export function getForceResult(): Outcome | null {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(FORCE_KEY);
    if (raw === 'CHOSEN' || raw === 'ALMOST CHOSEN' || raw === 'REGISTERED' || raw === 'NOT THIS TIME') {
      return raw;
    }
    if (raw === 'null') return null;
  }
  return FORCE_RESULT;
}

export function setForceResult(outcome: Outcome | null): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(FORCE_KEY, outcome === null ? 'null' : outcome);
}

// ---------------------------------------------------------------------------
// INCLUDE TEST RECORDS — ADMIN toggle.
//
// Test records (isTest: true) are created ONLY by the hidden admin "TEST FULL
// CHOSEN FLOW" control. By default they are EXCLUDED from every public
// statistic (projection aggregates, archive counts). An admin may opt to fold
// them into the public statistics by enabling this toggle. Default = false so
// production statistics are never polluted by test events.
// ---------------------------------------------------------------------------

const INCLUDE_TEST_KEY = 'almost-chosen/include-test-records/v1';

/** Default: test records are NOT included in public statistics. */
export const INCLUDE_TEST_RECORDS_DEFAULT = false;

export function getIncludeTestRecords(): boolean {
  if (typeof localStorage === 'undefined') return INCLUDE_TEST_RECORDS_DEFAULT;
  const raw = localStorage.getItem(INCLUDE_TEST_KEY);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return INCLUDE_TEST_RECORDS_DEFAULT;
}

export function setIncludeTestRecords(include: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(INCLUDE_TEST_KEY, include ? 'true' : 'false');
}
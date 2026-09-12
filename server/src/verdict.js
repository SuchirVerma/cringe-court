/**
 * Sentencing.
 *
 * The score is deducted from the evidence, not guessed. An inconclusive check
 * never counts against a site — we do not punish a page for defeating us — but
 * it is disclosed, because a 10/10 earned by three failed checks would be a lie.
 */

import { OUTCOME } from './evidence.js';
import { NOT_EXAMINED, GUIDELINES } from './law.js';

const DEDUCTION = { high: 3, medium: 2, low: 1 };

export function buildVerdict({ url, host, tier, site, findings, startedAt }) {
  const violations = findings.filter((f) => f.outcome === OUTCOME.VIOLATION);
  const cleared = findings.filter((f) => f.outcome === OUTCOME.CLEAR);
  const inconclusive = findings.filter((f) => f.outcome === OUTCOME.INCONCLUSIVE);

  const penalty = violations.reduce((sum, v) => sum + (DEDUCTION[v.confidence] ?? 2), 0);
  const score = Math.max(1, 10 - penalty);
  const guilty = violations.length > 0;

  return {
    url,
    host,
    tier,
    siteName: site?.display ?? null,
    guilty,
    headline: headlineFor(guilty, violations.length, inconclusive.length),
    score,
    outOf: 10,
    counts: {
      charges: findings.length,
      violations: violations.length,
      cleared: cleared.length,
      inconclusive: inconclusive.length,
    },
    // Every violation's remedies, flattened and attributed, for the fix list.
    remedies: violations.flatMap((v) =>
      v.remedies.map((text) => ({ charge: v.charge, exhibit: v.exhibit, text })),
    ),
    disclosure: {
      examined: findings.map((f) => f.charge),
      notExamined: NOT_EXAMINED,
      note:
        inconclusive.length > 0
          ? `${inconclusive.length} of ${findings.length} charges could not be determined on this page. The score reflects only what was actually observed.`
          : `All ${findings.length} charges were determined on the evidence.`,
    },
    citation: GUIDELINES,
    startedAt,
    deliveredAt: new Date().toISOString(),
    durationMs: startedAt ? Date.now() - new Date(startedAt).getTime() : null,
  };
}

function headlineFor(guilty, violationCount, inconclusiveCount) {
  if (!guilty && inconclusiveCount === 0) {
    return 'Not guilty. The court found nothing to charge, and it did look.';
  }
  if (!guilty) {
    return 'Not guilty on the evidence available. Some charges could not be determined.';
  }
  if (violationCount === 1) return 'Guilty on one count.';
  if (violationCount === 2) return 'Guilty on two counts.';
  return `Guilty on all ${violationCount} counts.`;
}

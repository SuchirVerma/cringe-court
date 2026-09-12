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

/*
  The order's own identity: a case number, the bench that signed it, and the
  sitting date. Cosmetic on the page, but it is what makes the verdict read as
  a document rather than a results panel, so it is issued here with the ruling
  rather than invented in the interface.

  The number counts cases heard since the server started. It is honest about
  what it is: the third case this session really is CC-2026-003.
*/
let heard = 0;

const BENCH = 'Hon. Justice CringeCourt, sitting alone';

function caseNumber(at) {
  heard += 1;
  return `CC-${at.getFullYear()}-${String(heard).padStart(3, '0')}`;
}

/** "12 September 2026", the way a cause list writes it. */
function sittingDate(at) {
  return at.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function buildVerdict({ url, host, tier, site, findings, startedAt }) {
  const violations = findings.filter((f) => f.outcome === OUTCOME.VIOLATION);
  const cleared = findings.filter((f) => f.outcome === OUTCOME.CLEAR);
  const inconclusive = findings.filter((f) => f.outcome === OUTCOME.INCONCLUSIVE);

  const penalty = violations.reduce((sum, v) => sum + (DEDUCTION[v.confidence] ?? 2), 0);
  const guilty = violations.length > 0;

  /*
    An inconclusive charge never counts against a site: we do not punish a page
    for defeating us. But a score still has to mean something. Handing out 10/10
    when two of three charges were never determined reads as an endorsement of a
    site we barely inspected, so below a majority of determined charges the court
    declines to score at all and says why. Any upheld charge is always reported,
    however little else could be checked.
  */
  const determined = findings.length - inconclusive.length;
  const ruled = guilty || determined > findings.length / 2;
  const score = ruled ? Math.max(1, 10 - penalty) : null;

  const deliveredAt = new Date();

  return {
    ruled,
    determined,
    url,
    host,
    tier,
    siteName: site?.display ?? null,
    guilty,
    order: {
      caseNumber: caseNumber(deliveredAt),
      defendant: host ?? url,
      bench: BENCH,
      sitting: sittingDate(deliveredAt),
    },
    headline: headlineFor(guilty, violations.length, inconclusive.length, ruled, determined, findings.length),
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
    deliveredAt: deliveredAt.toISOString(),
    durationMs: startedAt ? deliveredAt.getTime() - new Date(startedAt).getTime() : null,
  };
}

function headlineFor(guilty, violationCount, inconclusiveCount, ruled, determined, total) {
  if (!ruled) {
    return `Case adjourned. Only ${determined} of ${total} charges could be examined on this page.`;
  }
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

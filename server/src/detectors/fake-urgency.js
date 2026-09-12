/**
 * Exhibit A — False urgency.
 *
 * The method: read every countdown-like claim, wait, read again. A real deadline
 * falls. A fake one holds still or resets. We only charge on movement we can
 * prove, and a timer that legitimately counts down is explicitly cleared, which
 * matters on BookMyShow where seat-hold timers are genuine inventory locks.
 */

import { violation, clear, inconclusive } from '../evidence.js';
import { runProgram } from '../webcmd.js';

const CHARGE = 'FALSE_URGENCY';
const WAIT_SECONDS = 6;

/** Turn "02:59" / "3 minutes left" / "only 2 left" into a comparable number. */
function magnitude(candidate) {
  const clock = candidate.text.match(/\b(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?\b/);
  if (clock) {
    const [, a, b, c] = clock;
    return c ? Number(a) * 3600 + Number(b) * 60 + Number(c) : Number(a) * 60 + Number(b);
  }
  if (candidate.stockCount != null) return candidate.stockCount;
  return candidate.numbers?.length ? candidate.numbers.reduce((x, y) => x + y, 0) : null;
}

export async function detect({ sessionId, url, tier, site, log }) {
  log(`Exhibit A. Looking for countdowns and scarcity claims${site ? ` on ${site.display}` : ''}.`);

  const first = await runProgram(sessionId, 'scan-countdown', { navigateTo: url });
  if (!first.ok) {
    return inconclusive(CHARGE, { tier, reason: `Could not read the page: ${first.reason}` });
  }

  const candidates = first.data.candidates || [];
  if (candidates.length === 0) {
    log('Exhibit A. No countdown or scarcity claim on this page.');
    return clear(CHARGE, {
      tier,
      proof: 'Scanned the page for countdown timers and scarcity claims. None were present.',
    });
  }

  log(`Exhibit A. Found ${candidates.length} urgency claim${candidates.length === 1 ? '' : 's'}. Waiting ${WAIT_SECONDS}s to see if the clock actually moves.`);
  await new Promise((r) => setTimeout(r, WAIT_SECONDS * 1000));

  // Second read. No navigation: we want the same page, a few seconds older.
  const second = await runProgram(sessionId, 'scan-countdown', {});
  if (!second.ok) {
    return inconclusive(CHARGE, {
      tier,
      reason: `Read the timer once but could not read it again: ${second.reason}`,
      proof: `First reading: "${candidates[0].text}".`,
    });
  }

  const later = second.data.candidates || [];
  const compared = [];

  for (const before of candidates) {
    const after = later.find((c) => c.path === before.path) || later.find((c) => c.label && c.label === before.label);
    if (!after) continue;

    const a = magnitude(before);
    const b = magnitude(after);
    if (a == null || b == null) continue;

    compared.push({ before, after, a, b, moved: b < a, identical: before.text === after.text });
  }

  if (compared.length === 0) {
    return inconclusive(CHARGE, {
      tier,
      reason: 'The urgency elements changed identity between readings, so the two readings could not be compared',
      proof: `First reading: "${candidates[0].text}".`,
    });
  }

  // A genuine countdown somewhere on the page does not excuse a frozen one
  // elsewhere, but we charge only on the frozen ones.
  // A frozen clock is stronger evidence than a static stock claim, so if both
  // are present the clock is the one that gets charged and quoted.
  const rank = { clock: 0, stock: 1, 'urgency-copy': 2 };
  const frozen = compared
    .filter((c) => !c.moved)
    .sort((a, b) => (rank[a.before.kind] ?? 3) - (rank[b.before.kind] ?? 3));
  const honest = compared.filter((c) => c.moved);

  if (frozen.length === 0) {
    log(`Exhibit A. ${honest.length} timer${honest.length === 1 ? '' : 's'} counted down honestly. No charge.`);
    return clear(CHARGE, {
      tier,
      proof:
        `Found ${compared.length} countdown element${compared.length === 1 ? '' : 's'} and watched ${WAIT_SECONDS} seconds. ` +
        `Every one of them decreased as a real deadline should. First read "${compared[0].before.context || compared[0].before.text}", second read "${compared[0].after.context || compared[0].after.text}".`,
    });
  }

  const worst = frozen[0];
  const shown = worst.before.context || worst.before.text;
  const shownAfter = worst.after.context || worst.after.text;

  const detail = {
    firstReading: shown,
    secondReading: shownAfter,
    waitedSeconds: WAIT_SECONDS,
    kind: worst.before.kind,
    label: worst.before.label,
    frozenCount: frozen.length,
    honestCount: honest.length,
  };

  log(`Exhibit A. Charge filed. "${shown}" did not move in ${WAIT_SECONDS} seconds.`);

  return violation(CHARGE, {
    tier,
    confidence: worst.identical ? 'high' : 'medium',
    detail,
    proof:
      `At the first reading the element said "${shown}". ` +
      `After ${WAIT_SECONDS} seconds of real elapsed time it said "${shownAfter}". ` +
      (worst.b > worst.a
        ? 'The value went up, which no deadline does. '
        : 'The value did not fall. ') +
      (honest.length > 0
        ? `${honest.length} other timer on this page did count down correctly, so this is not a page-wide rendering fault.`
        : 'No timer on this page moved at all.'),
  });
}

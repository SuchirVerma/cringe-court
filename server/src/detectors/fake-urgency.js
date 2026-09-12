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

/**
 * Where a Tier 1 site keeps its urgency, and what to read once there.
 *
 * A named site earns two things the general analysis cannot have: somewhere
 * better to look than the URL it was handed, and the exact elements to read
 * once it gets there. Amazon's homepage carries no urgency claim whatsoever, so
 * scanning it and reporting "nothing found" would be true about that page and
 * misleading about the site.
 *
 * The learned profile overrides the seed, so re-exploring a site improves every
 * later run without a code change. Neither is load-bearing: with no profile and
 * no seed this returns the URL as given and the general sweep runs, which is
 * Tier 2 behaviour.
 */
function surfacePlan({ url, site, profile }) {
  const knowledge = profile?.urgency || site?.urgency;
  if (!knowledge) return { target: url, redirected: false, selectors: [], scrollPasses: 0 };

  const selectors = knowledge.selectors || [];
  const scrollPasses = knowledge.scrollPasses || 0;

  let path = '/';
  let origin = null;
  try {
    const parsed = new URL(url);
    path = parsed.pathname + parsed.search;
    origin = parsed.origin;
  } catch {
    return { target: url, redirected: false, selectors, scrollPasses };
  }

  // Already somewhere the claims live: read it where it stands.
  const keep = knowledge.keepPathPatterns || [];
  if (keep.some((p) => path.includes(p))) {
    return { target: url, redirected: false, selectors, scrollPasses };
  }

  if (!knowledge.surface) return { target: url, redirected: false, selectors, scrollPasses };

  return {
    target: origin + knowledge.surface,
    redirected: true,
    from: path,
    selectors,
    scrollPasses,
  };
}

/**
 * What "we found nothing" is worth saying.
 *
 * A clearance is a real result, so it has to carry what was actually examined.
 * "Nothing on this page" from a homepage that never carries a claim is close to
 * meaningless; "we went to the deal grid, read the stock line and the deal badge
 * by name, and neither claimed a deadline" is a finding. The difference is the
 * whole reason a site gets a Tier 1 profile.
 */
function nothingFoundProof({ plan, site, readSurface, namedReadings }) {
  const where = readSurface ? readSurface.replace(/^https?:\/\//, '').slice(0, 90) : 'the page';
  const parts = [];

  parts.push(
    plan.redirected
      ? `Went to ${where}, where ${site.display} keeps its deal and scarcity claims, and scanned it for countdown timers and scarcity claims.`
      : `Scanned ${where} for countdown timers and scarcity claims.`,
  );

  const read = (namedReadings || []).filter((r) => r.found && r.text);
  if (read.length > 0) {
    parts.push(
      `Read ${site.display}'s own ${read.length === 1 ? 'element' : 'elements'} directly: ` +
        read.map((r) => `${r.name} said "${r.text.slice(0, 60)}"`).join('; ') + '.',
    );
  }

  const missing = (namedReadings || []).filter((r) => !r.found);
  if (missing.length > 0) {
    const names = missing.map((r) => r.name);
    const list =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    parts.push(`${list} ${missing.length === 1 ? 'is' : 'are'} not on this kind of page.`);
  }

  parts.push('No claim carried a deadline or a stock count, so there was nothing to time.');
  return parts.join(' ');
}

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

export async function detect({ sessionId, url, tier, site, profile, log }) {
  const plan = surfacePlan({ url, site, profile });

  log(`Exhibit A. Looking for countdowns and scarcity claims${site ? ` on ${site.display}` : ''}.`);
  if (plan.redirected) {
    log(
      `Exhibit A. ${site.display} keeps its urgency claims on ${plan.target.replace(/^https?:\/\//, '')}, not on ${plan.from}. Going there to look.`,
    );
  }

  const first = await runProgram(sessionId, 'scan-countdown', {
    navigateTo: plan.target,
    scrollPasses: plan.scrollPasses,
    namedSelectors: plan.selectors,
  });
  if (!first.ok) {
    return inconclusive(CHARGE, { tier, reason: `Could not read the page: ${first.reason}` });
  }

  const readSurface = first.data.url || plan.target;
  const namedFound = (first.data.namedReadings || []).filter((r) => r.found && r.text);
  if (namedFound.length > 0) {
    log(
      `Exhibit A. Read ${namedFound.length} known ${site.display} element${namedFound.length === 1 ? '' : 's'} directly: ${namedFound.map((r) => r.name).join(', ')}.`,
    );
  }

  const candidates = first.data.candidates || [];
  if (candidates.length === 0) {
    log('Exhibit A. No countdown or scarcity claim on this page.');
    return clear(CHARGE, {
      tier,
      proof: nothingFoundProof({ plan, site, readSurface, namedReadings: first.data.namedReadings }),
      detail: {
        surface: readSurface,
        redirected: plan.redirected,
        namedReadings: first.data.namedReadings || [],
      },
    });
  }

  log(`Exhibit A. Found ${candidates.length} urgency claim${candidates.length === 1 ? '' : 's'}. Waiting ${WAIT_SECONDS}s to see if the clock actually moves.`);
  await new Promise((r) => setTimeout(r, WAIT_SECONDS * 1000));

  // Second read. No navigation: we want the same page, a few seconds older.
  const second = await runProgram(sessionId, 'scan-countdown', {
    namedSelectors: plan.selectors,
  });
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
      detail: { surface: readSurface, redirected: plan.redirected, examined: compared.length },
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
    surface: readSurface,
    // Whether the charged element was one the site profile pointed at, or one
    // the general sweep turned up. Worth knowing when a profile goes stale.
    viaProfile: !!worst.before.viaProfile,
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

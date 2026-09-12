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

  /*
    A learned profile names the one surface that actually carried a claim. A
    seed that has not been explored yet may only offer a list of candidates, in
    which case take the first: it is a starting point, and the scroll-and-retry
    ladder below covers a surface that turns out to be empty.
  */
  const surface = knowledge.surface || knowledge.surfaces?.[0] || null;
  if (!surface) return { target: url, redirected: false, selectors, scrollPasses };

  return {
    target: origin + surface,
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
function nothingFoundProof({ plan, site, readSurface, namedReadings, scrolled }) {
  const where = readSurface ? readSurface.replace(/^https?:\/\//, '').slice(0, 90) : 'the page';
  const parts = [];

  parts.push(
    plan.redirected
      ? `Went to ${where}, where ${site.display} keeps its deal and scarcity claims, and scanned it for countdown timers and scarcity claims.`
      : `Scanned ${where} for countdown timers and scarcity claims.`,
  );

  if (scrolled) {
    parts.push('Scrolled the whole page in case its offers load late, and scanned again.');
  }

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

/**
 * Recovery.
 *
 * A first attempt that comes back empty or broken is usually not the site
 * saying "nothing here". It is a page that had not finished assembling, or a
 * grid that renders nothing until the viewport moves. So every dead end gets
 * one alternate strategy before it is allowed to become "unable to analyse",
 * and every attempt is announced, because a recovery nobody can see reads as a
 * stall.
 *
 * One retry, not a loop. A second identical failure is the page telling us
 * something, and hammering it is both rude and slow.
 */
const RETRY_SETTLE_MS = 7000;
const LAZY_SCROLL_PASSES = 4;

/**
 * Run the scan, and if it fails outright, wait longer and run it once more.
 * Records what it tried so the finding can carry the recovery story.
 *
 * `run` is injectable so the retry behaviour can be tested without a browser.
 * A dead URL will not exercise this path: Chromium renders its own error page
 * rather than throwing, so the navigation succeeds and the thin-page guard
 * below catches it instead. This branch is for webcmd-level failures, which are
 * the ones worth retrying: a timed-out program, a lost session, a bad run.
 */
export async function scanWithRetry(sessionId, input, { log, what, attempts, run = runProgram }) {
  const first = await run(sessionId, 'scan-countdown', input);
  if (first.ok) return first;

  attempts.push({ step: what, outcome: 'failed', reason: first.reason });
  log(`Exhibit A. ${what} failed: ${first.reason}. Trying once more with a longer wait.`, 'warn');

  // The alternate strategy: the same read, given substantially more time to
  // settle. If the first attempt navigated, the retry has to navigate too,
  // because a failed goto may have left the session somewhere unexpected.
  const second = await run(sessionId, 'scan-countdown', {
    ...input,
    settleMs: RETRY_SETTLE_MS,
  });

  attempts.push({
    step: `${what} (retry)`,
    outcome: second.ok ? 'recovered' : 'failed',
    reason: second.ok ? null : second.reason,
  });
  log(
    second.ok
      ? `Exhibit A. The second attempt worked. Carrying on.`
      : `Exhibit A. The second attempt failed too: ${second.reason}.`,
    second.ok ? 'info' : 'warn',
  );

  return second;
}

/**
 * Match the claims in the second reading to the ones in the first.
 *
 * Strict matching identifies a claim by the element it lives in: the walked DOM
 * path, or the name a site profile gave it. That is the honest comparison,
 * because it is certainly the same element.
 *
 * Loose matching is the fallback for pages that redraw themselves between
 * readings, where every path has moved and a strict match finds nothing. It
 * pairs the Nth clock in the first reading with the Nth clock in the second, on
 * the reasoning that a page which still shows three countdowns in the same
 * order is still showing the same three countdowns. It can be wrong, so
 * anything it pairs is marked `loose` and the caller caps its confidence.
 */
export function pairReadings(before, after, { loose = false } = {}) {
  const pairs = [];

  if (!loose) {
    for (const was of before) {
      const now =
        after.find((c) => c.path === was.path) ||
        after.find((c) => c.label && c.label === was.label);
      if (!now) continue;

      const a = magnitude(was);
      const b = magnitude(now);
      if (a == null || b == null) continue;

      pairs.push({ before: was, after: now, a, b, moved: b < a, identical: was.text === now.text, loose: false });
    }
    return pairs;
  }

  // By kind, in order of appearance: the first clock to the first clock.
  const byKind = (list, kind) => list.filter((c) => c.kind === kind);
  for (const kind of ['clock', 'stock', 'urgency-copy']) {
    const wasList = byKind(before, kind);
    const nowList = byKind(after, kind);
    for (let i = 0; i < Math.min(wasList.length, nowList.length); i++) {
      const a = magnitude(wasList[i]);
      const b = magnitude(nowList[i]);
      if (a == null || b == null) continue;
      pairs.push({
        before: wasList[i],
        after: nowList[i],
        a,
        b,
        moved: b < a,
        identical: wasList[i].text === nowList[i].text,
        loose: true,
      });
    }
  }
  return pairs;
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

  // Every attempt and recovery, recorded so the finding can show its working.
  const attempts = [];

  const first = await scanWithRetry(
    sessionId,
    {
      navigateTo: plan.target,
      scrollPasses: plan.scrollPasses,
      namedSelectors: plan.selectors,
    },
    { log, what: 'Reading the page', attempts },
  );
  if (!first.ok) {
    return inconclusive(CHARGE, {
      tier,
      reason: `Could not read the page after two attempts: ${first.reason}`,
      detail: { surface: plan.target, attempts },
    });
  }

  const readSurface = first.data.url || plan.target;
  const namedFound = (first.data.namedReadings || []).filter((r) => r.found && r.text);
  if (namedFound.length > 0) {
    log(
      `Exhibit A. Read ${namedFound.length} known ${site.display} element${namedFound.length === 1 ? '' : 's'} directly: ${namedFound.map((r) => r.name).join(', ')}.`,
    );
  }

  let reading = first.data;
  let candidates = reading.candidates || [];

  /*
    Nothing on the first screen is not the same as nothing on the page.
    Offer strips, deal rails and "only N left" badges are routinely below the
    fold and mounted only when the viewport reaches them, so a site that does
    carry urgency would be cleared for having it further down. Scrolling is the
    alternate strategy, and the general analysis needs it more than a named site
    does: a profile already knows to scroll, an unfamiliar site does not.
  */
  if (candidates.length === 0 && !plan.scrollPasses) {
    log('Exhibit A. Nothing on the first screen. Scrolling the page in case its offers load late.');
    attempts.push({ step: 'First screen', outcome: 'empty', reason: 'no candidates above the fold' });

    const scrolled = await runProgram(sessionId, 'scan-countdown', {
      // No navigateTo: we are already on the page and only want to move down it.
      scrollPasses: LAZY_SCROLL_PASSES,
      namedSelectors: plan.selectors,
    });

    if (scrolled.ok) {
      /*
        Adopt the scrolled reading whether or not it turned anything up. It saw
        strictly more of the page than the first screen did, so everything
        downstream, the emptiness check included, should be judging what we
        actually ended up looking at.
      */
      reading = scrolled.data;
      candidates = reading.candidates || [];

      attempts.push({
        step: 'Scrolled the page',
        outcome: candidates.length > 0 ? 'recovered' : 'empty',
        found: candidates.length,
      });
      if (candidates.length > 0) {
        log(
          `Exhibit A. Scrolling found ${candidates.length} claim${candidates.length === 1 ? '' : 's'} that were not on the first screen.`,
        );
      }
    } else {
      attempts.push({ step: 'Scrolled the page', outcome: 'failed', reason: scrolled.reason });
      log(`Exhibit A. Could not scroll the page: ${scrolled.reason}. Judging on the first screen.`, 'warn');
    }
  }

  /*
    A page that barely rendered cannot clear anyone.

    Zero candidates reads identically whether the page honestly carries no
    urgency claim or whether we were handed a bot check, an interstitial, or a
    render that never arrived. A real storefront runs to thousands of
    characters, so a few hundred means we did not see the site.
  */
  const MIN_PAGE_TEXT = 600;
  /*
    Measured on the freshest reading, not the first one. If scrolling was tried
    above, `reading` is the scrolled result, and a page that renders its content
    lazily is thin before the scroll and full after it. Judging it on the first
    screen would call a site a bot check for the crime of loading late.
  */
  const textLength = reading.textLength ?? null;
  if (candidates.length === 0 && textLength !== null && textLength < MIN_PAGE_TEXT) {
    log(`Exhibit A. The page returned only ${textLength} characters, so there was nothing to examine.`, 'warn');
    return inconclusive(CHARGE, {
      tier,
      reason:
        `The page returned almost no content (${textLength} characters). That is a bot check, a block, or a page ` +
        'with nothing on it, and none of those show whether the site uses false urgency.',
      proof: `Loaded ${readSurface} and found ${textLength} characters of text.`,
      detail: { surface: readSurface, textLength, attempts },
    });
  }

  if (candidates.length === 0) {
    log('Exhibit A. No countdown or scarcity claim on this page, scrolled or otherwise.');
    return clear(CHARGE, {
      tier,
      proof: nothingFoundProof({
        plan,
        site,
        readSurface,
        namedReadings: reading.namedReadings,
        scrolled: !plan.scrollPasses,
      }),
      detail: {
        surface: readSurface,
        redirected: plan.redirected,
        namedReadings: reading.namedReadings || [],
        attempts,
      },
    });
  }

  log(`Exhibit A. Found ${candidates.length} urgency claim${candidates.length === 1 ? '' : 's'}. Waiting ${WAIT_SECONDS}s to see if the clock actually moves.`);
  await new Promise((r) => setTimeout(r, WAIT_SECONDS * 1000));

  // Second read. No navigation: we want the same page, a few seconds older.
  const second = await scanWithRetry(
    sessionId,
    { namedSelectors: plan.selectors },
    { log, what: 'Reading the page a second time', attempts },
  );
  if (!second.ok) {
    return inconclusive(CHARGE, {
      tier,
      reason: `Read the timer once but could not read it again after two attempts: ${second.reason}`,
      proof: `First reading: "${candidates[0].text}".`,
      detail: { surface: readSurface, attempts },
    });
  }

  let compared = pairReadings(candidates, second.data.candidates || []);

  /*
    No pair survived. The page re-rendered between the two readings and every
    walked DOM path moved, which single-page storefronts do constantly.

    The alternate strategy is a third reading matched more loosely: a claim is
    the same claim if it is the same kind of claim sitting in the same place in
    the list, even if its element moved. That is weaker evidence than a matched
    path, so it is only ever used to establish that a value did not change, and
    the charge that follows is capped at medium confidence.
  */
  if (compared.length === 0) {
    log('Exhibit A. The page redrew itself between readings. Reading once more and matching by position.', 'warn');
    attempts.push({ step: 'Pairing the two readings', outcome: 'failed', reason: 'every element moved' });

    const third = await runProgram(sessionId, 'scan-countdown', { namedSelectors: plan.selectors });
    if (third.ok) {
      compared = pairReadings(candidates, third.data.candidates || [], { loose: true });
      attempts.push({
        step: 'Matched by position',
        outcome: compared.length > 0 ? 'recovered' : 'failed',
        paired: compared.length,
      });
      if (compared.length > 0) {
        log(`Exhibit A. Matched ${compared.length} claim${compared.length === 1 ? '' : 's'} by position instead.`);
      }
    } else {
      attempts.push({ step: 'Third reading', outcome: 'failed', reason: third.reason });
    }
  }

  if (compared.length === 0) {
    return inconclusive(CHARGE, {
      tier,
      reason:
        'The page redrew itself between readings and the same claim could not be found twice, ' +
        'even matching by position, so there is no pair of readings to compare',
      proof: `First reading: "${candidates[0].text}".`,
      detail: { surface: readSurface, attempts },
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
      detail: {
        surface: readSurface,
        redirected: plan.redirected,
        examined: compared.length,
        attempts,
      },
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
    // Whether the two readings were matched by element or only by position.
    matchedLoosely: !!worst.loose,
    attempts,
  };

  log(`Exhibit A. Charge filed. "${shown}" did not move in ${WAIT_SECONDS} seconds.`);

  /*
    A loose match only establishes that the Nth claim of its kind reads the same
    as it did before, not that it is certainly the same element, so it can never
    carry high confidence however identical the text is.
  */
  const confidence = worst.loose ? 'low' : worst.identical ? 'high' : 'medium';

  return violation(CHARGE, {
    tier,
    confidence,
    detail,
    proof:
      `At the first reading the element said "${shown}". ` +
      `After ${WAIT_SECONDS} seconds of real elapsed time it said "${shownAfter}". ` +
      (worst.b > worst.a
        ? 'The value went up, which no deadline does. '
        : 'The value did not fall. ') +
      (honest.length > 0
        ? `${honest.length} other timer on this page did count down correctly, so this is not a page-wide rendering fault. `
        : 'No timer on this page moved at all. ') +
      (worst.loose
        ? 'The page redrew itself between readings, so the two readings were matched by position rather than by element, and this finding is reported at low confidence.'
        : ''),
  });
}

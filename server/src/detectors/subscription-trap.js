/**
 * Exhibit B — Subscription trap.
 *
 * Counts the distance from the subscription or account page to a cancel
 * affordance. More than three steps is the charge; vague labelling where a
 * clear "Cancel" belongs is also the charge.
 *
 * This detector navigates, so it is bounded: link-following only, depth-capped,
 * and it stops the instant a cancel control is visible. It never clicks it.
 * Locating the exit is the evidence. Using it would be acting on the user's
 * account, which this tool does not do.
 */

import { violation, clear, inconclusive } from '../evidence.js';
import { runProgram } from '../webcmd.js';
import { classifyFailure, wallReason } from '../recovery.js';

const CHARGE = 'SUBSCRIPTION_TRAP';
const ACCEPTABLE_STEPS = 3;

function guessAccountUrls(url) {
  const u = new URL(url);
  const base = `${u.protocol}//${u.host}`;
  const paths = ['/account', '/my-account', '/settings', '/profile', '/subscriptions'];
  // Static sites serve these with an extension, so try both spellings.
  return [...paths, ...paths.map((p) => `${p}.html`)].map((p) => base + p);
}

export async function detect({ sessionId, url, tier, site, profile, log }) {
  const targets = [];
  if (tier === 1 && site) {
    const u = new URL(url);
    // Learned order first when there is one, so the address that opened last
    // time is tried before the ones that 404'd. Same honesty rule as the cart:
    // only call it learned when it actually is.
    /*
      A learned search order beats the seed's, because it puts the addresses
      that actually opened ahead of the ones that 404'd. Without it the run
      spends its first navigation on a page exploration already proved is not
      there. Only call it learned when it actually is.
    */
    const learnedOrder = profile?.accountSearchOrder?.length ? profile.accountSearchOrder : null;
    const known = learnedOrder || [
      ...(site.subscriptionPaths || []),
      ...(site.accountPaths || []),
    ];
    targets.push(...known.map((p) => `${u.protocol}//${u.host}${p}`));
    log(
      learnedOrder
        ? `Exhibit B. Using the learned account map for ${site.display}.`
        : `Exhibit B. No learned account map for ${site.display} yet, so using the seed pages.`,
    );
  } else {
    log('Exhibit B. Looking for an account or subscription area.');
  }
  targets.push(...guessAccountUrls(url));

  let best = null;
  let lastReason = null;

  let anyPageReached = false;

  /*
    Every candidate tried, and why it was passed over. Trying eight addresses is
    itself the alternate-strategy ladder for this charge: a 404 on /account is
    not a finding, it is a reason to try /my-account next. Recorded rather than
    logged line by line, because eight lines of "that one was not there" buries
    the moment that matters in the feed, and summarised once below.
  */
  const attempts = [];

  let retryAnnounced = false;

  for (const target of targets.slice(0, 8)) {
    const run = await runProgram(sessionId, 'scan-cancel-flow', { navigateTo: target, maxDepth: 4 });
    if (!run.ok) {
      lastReason = run.reason;
      const kind = classifyFailure(run.reason);
      attempts.push({ target, outcome: kind, reason: run.reason });
      /*
        The first miss is announced as a retry, so the feed shows the search
        turning to its alternate rather than going quiet. Later misses fold into
        the summary below; eight lines of "not there" would bury the finding.
      */
      if (!retryAnnounced && targets.indexOf(target) < targets.length - 1) {
        retryAnnounced = true;
        const next = targets[targets.indexOf(target) + 1];
        log(`Exhibit B. Retry: alternate account address ${next.replace(/^https?:\/\/[^/]+/, '')} (${kind === 'timeout' ? 'the first timed out' : 'the first could not be read'}).`, 'warn');
      }
      continue;
    }

    const data = run.data;

    // Same rule as the other detectors: an unrecognisable shape is a failed
    // read, not something to reach into. Blind access throws a raw TypeError
    // that ends up quoted at the user as the reason for an unproven charge.
    if (!data || typeof data !== 'object' || !Array.isArray(data.trail)) {
      lastReason = 'the page did not return a readable navigation structure';
      attempts.push({ target, outcome: 'unreadable', reason: lastReason });
      continue;
    }

    // The page was not there. Try the next candidate rather than concluding
    // anything from a 404.
    if (data.notFound) {
      lastReason = `${target} returned ${data.httpStatus}`;
      attempts.push({ target, outcome: 'not-found', status: data.httpStatus });
      continue;
    }

    // A bot check is not a subscription page, and this tool does not try to
    // get past one. Say so, in those words, and stop.
    if (data.botCheck) {
      attempts.push({ target, outcome: 'bot-protection' });
      log('Exhibit B. Bot protection stood in the way. Cannot judge a cancellation flow behind a verification page.', 'warn');
      return inconclusive(CHARGE, {
        tier,
        reason: wallReason('bot-protection', 'the subscription area'),
        proof: `Reached ${target} and was shown a verification page instead of the site.`,
        detail: { attempts, triedCount: attempts.length, wall: 'bot-protection' },
      });
    }
    anyPageReached = true;
    if (data.loginWall) {
      attempts.push({ target, outcome: 'login-wall' });
      log('Exhibit B. Hit a sign-in wall. Cannot judge a cancellation flow we cannot enter.');
      return inconclusive(CHARGE, {
        tier,
        reason:
          'The subscription area is behind a sign-in wall. The cancellation flow cannot be examined without ' +
          'signing in, and this tool does not use accounts it was not given.',
        proof: `Reached ${data.trail?.[0]?.url || target} and was asked to sign in.`,
        detail: { attempts, triedCount: attempts.length },
      });
    }

    // Prefer the run that actually located a cancel control; otherwise keep the
    // deepest honest attempt so we can report the exhaustive search.
    if (data.found) {
      attempts.push({ target, outcome: 'found-cancel', depth: data.found.depth });
      best = { data, target };
      break;
    }
    attempts.push({ target, outcome: 'no-cancel-here' });
    if (!best) best = { data, target };
  }

  // The search, said once, so the feed shows the work without drowning in it.
  const missed = attempts.filter((a) => ['not-found', 'unreadable', 'timeout'].includes(a.outcome)).length;
  if (missed > 0) {
    log(
      `Exhibit B. Tried ${attempts.length} account address${attempts.length === 1 ? '' : 'es'}; ` +
        `${missed} ${missed === 1 ? 'was not there or could not be read' : 'were not there or could not be read'}.`,
    );
  }

  if (!best) {
    // Name the wall. A timeout and a 404 are different failures and a reader
    // deciding whether to try again deserves to know which they hit.
    const kinds = attempts.map((a) => a.outcome);
    const wall = kinds.includes('timeout')
      ? 'timeout'
      : kinds.every((k) => k === 'not-found')
        ? 'not-found'
        : null;
    return inconclusive(CHARGE, {
      tier,
      reason: wall
        ? wallReason(wall, 'the account or subscription area', `Tried ${attempts.length} address${attempts.length === 1 ? '' : 'es'}.`)
        : anyPageReached
          ? `Reached the account area but could not analyse it. ${lastReason || ''}`.trim()
          : `No account or subscription page could be found on this site. ${lastReason || ''}`.trim(),
      detail: { attempts, triedCount: attempts.length, wall },
    });
  }

  const { data, target } = best;

  if (!data.found) {
    /*
      The defendant's protection.

      "No cancel control here" is only evidence of a trap if we can show we were
      somewhere a cancel control belongs. Signed out, a subscription page shows
      marketing, not controls, and charging on that would be accusing a real
      company of a legal violation over a page we never actually saw. Without
      proof we were inside the account, the honest answer is that we could not
      tell.
    */
    if (!data.provenInsideAccount) {
      log('Exhibit B. Could not get inside the account, so the cancellation flow cannot be judged.', 'warn');
      return inconclusive(CHARGE, {
        tier,
        reason:
          'Could not confirm we were inside a signed-in account, so the absence of a cancel control proves nothing. ' +
          'Judging a cancellation flow needs an account this tool was not given.',
        proof: `Visited ${data.trail.map((t) => t.title || t.url).join(' → ')} without reaching signed-in account pages.`,
        detail: { attempts, triedCount: attempts.length, startedAt: target },
      });
    }

    log('Exhibit B. Charge filed. No cancel control anywhere in the subscription area.');
    return violation(CHARGE, {
      tier,
      confidence: 'medium',
      detail: { steps: data.steps, labelFound: null, exhausted: true, attempts, startedAt: target },
      proof:
        `Started at ${target} and followed the subscription and billing links ${data.steps} level${data.steps === 1 ? '' : 's'} deep, ` +
        `inside a signed-in account. No cancel or unsubscribe control was reachable. ` +
        `The pages visited were: ${data.trail.map((t) => t.title || t.url).join(' → ')}.`,
    });
  }

  const steps = data.found.depth + 1;
  const vagueOnly = data.found.strength !== 'exact';
  const tooDeep = steps > ACCEPTABLE_STEPS;

  if (!tooDeep && !vagueOnly) {
    log(`Exhibit B. Cancel reachable in ${steps} step${steps === 1 ? '' : 's'}, clearly labelled. No charge.`);
    return clear(CHARGE, {
      tier,
      detail: { steps, labelFound: data.found.text, attempts, startedAt: target },
      proof:
        `Starting at ${target}, a clearly labelled "${data.found.text}" control was reachable in ` +
        `${steps} step${steps === 1 ? '' : 's'}. That is a cancellation flow a consumer can actually find.`,
    });
  }

  const detail = { steps, labelFound: data.found.text, vagueOnly, exhausted: false, attempts, startedAt: target };
  log(`Exhibit B. Charge filed. Cancel is ${steps} step${steps === 1 ? '' : 's'} deep${vagueOnly ? ' and vaguely labelled' : ''}.`);

  return violation(CHARGE, {
    tier,
    confidence: tooDeep && vagueOnly ? 'high' : 'medium',
    detail,
    proof:
      `Starting at ${target}, reaching a cancellation control took ${steps} step${steps === 1 ? '' : 's'} ` +
      `(${data.trail.map((t) => t.title || t.url).join(' → ')}). ` +
      (vagueOnly
        ? `The control that ends the subscription is labelled "${data.found.text}" rather than a plain "Cancel subscription". `
        : '') +
      `The guidelines treat a cancellation that is harder than the subscription as the violation, and ` +
      `${ACCEPTABLE_STEPS} steps is the threshold this court applies.`,
  });
}

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
    const known = [...(profile?.subscriptionPaths || site.subscriptionPaths || []), ...(profile?.accountPaths || site.accountPaths || [])];
    targets.push(...known.map((p) => `${u.protocol}//${u.host}${p}`));
    log(`Exhibit B. Starting from the known subscription pages for ${site.display}.`);
  } else {
    log('Exhibit B. Looking for an account or subscription area.');
  }
  targets.push(...guessAccountUrls(url));

  let best = null;
  let lastReason = null;

  let anyPageReached = false;

  for (const target of targets.slice(0, 8)) {
    const run = await runProgram(sessionId, 'scan-cancel-flow', { navigateTo: target, maxDepth: 4 });
    if (!run.ok) {
      lastReason = run.reason;
      continue;
    }

    const data = run.data;

    // The page was not there. Try the next candidate rather than concluding
    // anything from a 404.
    if (data.notFound) {
      lastReason = `${target} returned ${data.httpStatus}`;
      continue;
    }
    anyPageReached = true;
    if (data.loginWall) {
      log('Exhibit B. Hit a sign-in wall. Cannot judge a cancellation flow we cannot enter.');
      return inconclusive(CHARGE, {
        tier,
        reason:
          'The subscription area is behind a sign-in wall. The cancellation flow cannot be examined without ' +
          'signing in, and this tool does not use accounts it was not given.',
        proof: `Reached ${data.trail?.[0]?.url || target} and was asked to sign in.`,
      });
    }

    // Prefer the run that actually located a cancel control; otherwise keep the
    // deepest honest attempt so we can report the exhaustive search.
    if (data.found) {
      best = { data, target };
      break;
    }
    if (!best) best = { data, target };
  }

  if (!best) {
    return inconclusive(CHARGE, {
      tier,
      reason: anyPageReached
        ? `Reached the account area but could not analyse it. ${lastReason || ''}`.trim()
        : `No account or subscription page could be found on this site. ${lastReason || ''}`.trim(),
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
      });
    }

    log('Exhibit B. Charge filed. No cancel control anywhere in the subscription area.');
    return violation(CHARGE, {
      tier,
      confidence: 'medium',
      detail: { steps: data.steps, labelFound: null, exhausted: true },
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
      proof:
        `Starting at ${target}, a clearly labelled "${data.found.text}" control was reachable in ` +
        `${steps} step${steps === 1 ? '' : 's'}. That is a cancellation flow a consumer can actually find.`,
    });
  }

  const detail = { steps, labelFound: data.found.text, vagueOnly, exhausted: false };
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

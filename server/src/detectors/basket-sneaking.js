/**
 * Exhibit C — Basket sneaking.
 *
 * Charges only on a checked control that costs money and that the consumer did
 * not choose. Terms and privacy boxes are excluded upstream in the page program:
 * a ticked "I accept the terms" is a different pattern and not this one.
 */

import { violation, clear, inconclusive } from '../evidence.js';
import { runProgram } from '../webcmd.js';
import { hostOf } from '../sites.js';

const CHARGE = 'BASKET_SNEAKING';

/** Where the cart plausibly lives, for Tier 2 sites that give us no map. */
function guessCartUrls(url) {
  const u = new URL(url);
  const base = `${u.protocol}//${u.host}`;
  return ['/cart', '/checkout', '/basket', '/viewcart', '/shopping-cart'].map((p) => base + p);
}

export async function detect({ sessionId, url, tier, site, profile, log }) {
  // Tier 1 knows where the cart is. Tier 2 tries the page given, then guesses.
  const targets = [];
  if (tier === 1 && site) {
    const u = new URL(url);
    const known = profile?.cartPaths || site.cartPaths || [];
    targets.push(...known.map((p) => `${u.protocol}//${u.host}${p}`));
    log(`Exhibit C. Using the learned profile for ${site.display} to find the cart.`);
  } else {
    log('Exhibit C. Unfamiliar site, so looking for a cart the general way.');
  }
  targets.push(url, ...guessCartUrls(url));

  let result = null;
  let reached = null;
  const attempts = [];

  for (const target of targets.slice(0, 5)) {
    const run = await runProgram(sessionId, 'scan-checkboxes', { navigateTo: target });
    attempts.push({ target, ok: run.ok, reason: run.reason });
    if (!run.ok) continue;

    // A page with no checkboxes at all is probably not the cart. Keep looking,
    // but remember it so we can still report honestly if nothing better turns up.
    if (!result) {
      result = run.data;
      reached = target;
    }
    if (run.data.checkboxesFound > 0 || run.data.cartLines.length > 0) {
      result = run.data;
      reached = target;
      break;
    }
  }

  if (!result) {
    return inconclusive(CHARGE, {
      tier,
      reason: `Could not open a cart or checkout page on ${hostOf(url)}. ${attempts[0]?.reason || ''}`.trim(),
    });
  }

  const preTicked = result.preTicked || [];
  const charged = preTicked.filter((p) => p.hasPrice || p.chargeWord);

  if (charged.length === 0) {
    log('Exhibit C. Nothing pre-ticked that costs money.');
    return clear(CHARGE, {
      tier,
      proof:
        `Examined ${reached}. Found ${result.checkboxesFound} checkbox${result.checkboxesFound === 1 ? '' : 'es'}` +
        (preTicked.length
          ? `, ${preTicked.length} of them pre-ticked, none attached to a charge.`
          : ', none of them pre-ticked with a charge attached.'),
    });
  }

  const worst = charged.find((c) => c.hasPrice) || charged[0];
  const itemLabel = worst.ariaLabel || worst.chargeWord || labelFrom(worst.context);

  const detail = {
    itemLabel,
    price: worst.price,
    count: charged.length,
    chargeWord: worst.chargeWord,
  };

  log(`Exhibit C. Charge filed. ${charged.length} pre-ticked item${charged.length === 1 ? '' : 's'} with a cost attached.`);

  return violation(CHARGE, {
    tier,
    confidence: worst.hasPrice ? 'high' : 'medium',
    detail,
    proof:
      `On ${reached}, ${charged.length} checkbox${charged.length === 1 ? ' was' : 'es were'} already ticked on arrival ` +
      `with a charge attached. The first reads: "${truncate(worst.context, 180)}"` +
      (worst.price ? ` and carries ${worst.price}.` : '.') +
      ' No consumer action set this state.',
  });
}

function labelFrom(context) {
  if (!context) return null;
  const first = context.split('|')[0].trim();
  return first ? truncate(first, 60) : null;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

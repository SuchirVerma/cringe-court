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
    // Say which one it actually is. Claiming a learned profile we do not have
    // undermines the one moment in the run where that distinction is the point.
    log(
      profile
        ? `Exhibit C. Using the learned profile for ${site.display} to find the cart.`
        : `Exhibit C. No learned profile yet, so using the seed map for ${site.display} to find the cart.`,
    );
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

    /*
      Do not trust the shape. A page program can come back wrapped, truncated,
      or as an error object the CLI framed as success, and reaching into it
      blindly throws a raw TypeError that surfaces to the user as the reason a
      charge could not be determined. Treat anything unrecognisable as a failed
      read of that page and move on.
    */
    const shaped =
      run.data && typeof run.data === 'object' && Array.isArray(run.data.preTicked);
    if (!shaped) {
      attempts.push({ target, ok: false, reason: 'the page did not return a readable cart structure' });
      continue;
    }

    // A page with no checkboxes at all is probably not the cart. Keep looking,
    // but remember it so we can still report honestly if nothing better turns up.
    if (!result) {
      result = run.data;
      reached = target;
    }
    // Prefer a page that is demonstrably a basket over one that merely loaded.
    if (run.data.looksLikeCart || run.data.preTicked.length > 0) {
      result = run.data;
      reached = target;
      break;
    }
  }

  if (!result) {
    const why = attempts.find((a) => !a.ok && a.reason)?.reason;
    return inconclusive(CHARGE, {
      tier,
      reason: `Could not open a readable cart or checkout page on ${hostOf(url)}${why ? `: ${why}` : '.'}`,
    });
  }

  const preTicked = result.preTicked || [];
  const charged = preTicked.filter((p) => p.hasPrice || p.chargeWord);

  if (charged.length === 0) {
    // Clearing a site is a claim too. Only make it if we actually saw a basket.
    if (!result.looksLikeCart) {
      log('Exhibit C. Could not reach a real cart page, so there is nothing to clear or charge.', 'warn');
      return inconclusive(CHARGE, {
        tier,
        reason:
          'Could not reach a cart or checkout page with items in it. Most carts need a signed-in session or a ' +
          'product added first, so nothing here proves the checkout is clean.',
        proof: `Loaded ${reached} but it did not present as a basket.`,
      });
    }

    /*
      An empty basket cannot clear anyone.

      Matching empty-state copy is a losing game: every site words it
      differently ("your bag is empty", "it feels so light in here", a picture
      of a box). So the test is positive evidence instead of absence — at least
      one line item with a price. Add-ons are offered alongside items, so a
      basket with nothing in it has nothing to sneak into, and reporting that as
      clean clears a company on a page where the pattern could not appear.

      This errs toward refusing to clear, which is the right direction: a missed
      clearance costs a "come back with something in your cart", while a wrong
      one tells a user a checkout is honest when nobody checked.
    */
    /*
      Priced tiles are not basket contents. Every shop fills its empty-cart page
      with recommendations, and those carry prices, so a count of priced rows
      alone reported "a basket holding 2 items" on Amazon's empty cart and
      cleared it 10/10. A row you can remove or re-quantify is a row you own.
    */
    if (result.cartLines.length === 0 || !result.cartAffordances) {
      log('Exhibit C. The basket has no items, so there is nothing to clear or charge.', 'warn');
      return inconclusive(CHARGE, {
        tier,
        reason:
          'The basket had no items in it, and paid add-ons are offered alongside items. Add a product to the ' +
          'cart and run this again to examine the checkout properly.',
        proof:
          `Reached ${reached}` +
          (result.looksEmpty
            ? ', which reported itself empty.'
            : result.cartLines.length > 0
              ? `. It showed ${result.cartLines.length} priced item${result.cartLines.length === 1 ? '' : 's'} but no way to remove or re-quantify any of them, so they are recommendations rather than basket contents.`
              : ' but found no line items.'),
      });
    }

    log(`Exhibit C. ${result.cartLines.length} item${result.cartLines.length === 1 ? '' : 's'} in the basket, nothing pre-ticked that costs money.`);
    return clear(CHARGE, {
      tier,
      proof:
        `Examined ${reached}, a basket holding ${result.cartLines.length} item${result.cartLines.length === 1 ? '' : 's'}. ` +
        `Found ${result.checkboxesFound} checkbox${result.checkboxesFound === 1 ? '' : 'es'}` +
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

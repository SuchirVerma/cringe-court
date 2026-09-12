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
import { classifyFailure, wallReason } from '../recovery.js';

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
    /*
      Say which map this actually is, not merely whether a profile file exists.
      A profile learned before cart exploration existed carries no cartPaths,
      and announcing "using the learned profile to find the cart" while quietly
      falling back to the seed list is the exact overclaim the tier distinction
      is supposed to be honest about.
    */
    const learned = profile?.cartPaths?.length ? profile.cartPaths : null;
    const known = learned || site.cartPaths || [];
    targets.push(...known.map((p) => `${u.protocol}//${u.host}${p}`));
    log(
      learned
        ? `Exhibit C. Using the learned cart map for ${site.display}.`
        : `Exhibit C. No learned cart map for ${site.display} yet, so using the seed map.`,
    );
  } else {
    log('Exhibit C. Unfamiliar site, so looking for a cart the general way.');
  }
  targets.push(url, ...guessCartUrls(url));

  let result = null;
  let reached = null;
  const attempts = [];

  let retryAnnounced = false;
  const tried = targets.slice(0, 5);

  for (const target of tried) {
    const run = await runProgram(sessionId, 'scan-checkboxes', { navigateTo: target });
    const kind = run.ok ? null : classifyFailure(run.reason);
    attempts.push({ target, ok: run.ok, reason: run.reason, kind });
    if (!run.ok) {
      /*
        The first miss is announced as a retry, so the feed shows the search
        turning to its alternate rather than going quiet. Later misses fold
        into the summary below.
      */
      const i = tried.indexOf(target);
      if (!retryAnnounced && i < tried.length - 1) {
        retryAnnounced = true;
        log(`Exhibit C. Retry: alternate cart address ${tried[i + 1].replace(/^https?:\/\/[^/]+/, '')} (${kind === 'timeout' ? 'the first timed out' : 'the first could not be read'}).`, 'warn');
      }
      continue;
    }

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
      // Amend this target's entry rather than adding a second one, or five
      // addresses read as ten in the feed.
      Object.assign(attempts[attempts.length - 1], { ok: false, reason: 'the page did not return a readable cart structure', kind: 'unreadable' });
      continue;
    }

    // A bot check is not a cart. Say so, in those words, and stop.
    if (run.data.botCheck) {
      attempts.push({ target, ok: false, kind: 'bot-protection' });
      log('Exhibit C. Bot protection stood in the way. Cannot examine a checkout behind a verification page.', 'warn');
      return inconclusive(CHARGE, {
        tier,
        reason: wallReason('bot-protection', 'the cart'),
        proof: `Reached ${target} and was shown a verification page instead of the site.`,
        detail: { surface: target, attempts, wall: 'bot-protection' },
      });
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

  /*
    The cart search, said once. Trying five addresses is this charge's
    alternate-strategy ladder: /cart missing is a reason to try /checkout, not a
    finding. Logged as one line rather than five, so the feed shows the work
    without burying the moment that matters.
  */
  const missed = attempts.filter((a) => !a.ok).length;
  if (missed > 0) {
    log(
      `Exhibit C. Tried ${attempts.length} cart address${attempts.length === 1 ? '' : 'es'}; ` +
        `${missed} could not be read.`,
    );
  }

  if (!result) {
    const why = attempts.find((a) => !a.ok && a.reason)?.reason;
    // Name the wall when every attempt hit the same one.
    const wall = attempts.some((a) => a.kind === 'timeout') ? 'timeout' : null;
    return inconclusive(CHARGE, {
      tier,
      reason: wall
        ? wallReason(wall, 'the cart or checkout page', `Tried ${attempts.length} address${attempts.length === 1 ? '' : 'es'} on ${hostOf(url)}.`)
        : `Could not open a readable cart or checkout page on ${hostOf(url)}${why ? `: ${why}` : '.'}`,
      detail: { attempts, triedCount: attempts.length, wall },
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
        detail: { surface: reached, attempts, triedCount: attempts.length },
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
        detail: { surface: reached, attempts, cartLines: result.cartLines.length },
      });
    }

    log(`Exhibit C. ${result.cartLines.length} item${result.cartLines.length === 1 ? '' : 's'} in the basket, nothing pre-ticked that costs money.`);
    return clear(CHARGE, {
      tier,
      detail: { surface: reached, attempts, cartLines: result.cartLines.length, checkboxesFound: result.checkboxesFound },
      proof:
        `Examined ${reached}, a basket holding ${result.cartLines.length} item${result.cartLines.length === 1 ? '' : 's'}. ` +
        `Found ${result.checkboxesFound} checkbox${result.checkboxesFound === 1 ? '' : 'es'}` +
        (preTicked.length
          ? `, ${preTicked.length} of them pre-ticked, none attached to a charge.`
          : ', none of them pre-ticked with a charge attached.'),
    });
  }

  const worst = charged.find((c) => c.hasPrice) || charged[0];
  /*
    What the thing is actually called, in the order a reader would want it.
    The charge word comes last on purpose: it is the category that matched the
    pattern ("protection"), not the name on the box ("Purchase Protection
    Plan"), and quoting the category where the name was available made the
    evidence read as vaguer than the proof beneath it.
  */
  const itemLabel = worst.ariaLabel || labelFrom(worst.context) || worst.chargeWord;

  const detail = {
    itemLabel,
    price: worst.price,
    count: charged.length,
    chargeWord: worst.chargeWord,
    surface: reached,
    attempts,
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

/**
 * The add-on's name, pulled out of the row's text.
 *
 * A basket row reads "Purchase Protection Plan — covers accidental damage for
 * 12 months ₹149". The name is the part before the sales copy starts, so cut at
 * the first dash, price or sentence break and keep the head. Quoting the whole
 * row back at the reader turns a punchline into a paragraph.
 */
export function labelFrom(context) {
  if (!context) return null;

  const head = context
    .split('|')[0]
    .split(/\s[—–-]\s|[.•]\s|(?=₹|\bRs\.?\s?\d|\$\d)/)[0]
    .trim()
    // Leading checkbox glyphs and stray punctuation from the row's markup.
    .replace(/^[\s☐☑✓•\-–—:]+/, '')
    .trim();

  if (!head || head.length < 3) return null;

  /*
    A price is not a name. The cut above cannot fire on a row that opens with
    the amount ("₹149"), because a zero-width match at position zero does not
    split, so the amount survives as the whole head. Strip the money and see
    whether anything nameable is left.
  */
  const nameable = head.replace(/₹|\$|\bRs\.?\b|[\d,.]+/g, '').trim();
  if (nameable.length < 3) return null;

  return truncate(head, 60);
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

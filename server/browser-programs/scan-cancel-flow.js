/**
 * Exhibit B, field work: how far is the exit?
 *
 * Maps the route from an account or subscription page toward a cancel action,
 * counting steps. This is the one detector that navigates, so the rules are
 * strict: it follows links only, it never clicks a control whose label suggests
 * the cancellation would actually happen, and it stops the moment it can see a
 * real cancel affordance. Finding the door is the whole job. Opening it is not.
 *
 * INPUT: { navigateTo?: string, maxDepth?: number }
 */

const MAX_DEPTH = INPUT.maxDepth ?? 4;

if (INPUT.navigateTo) {
  const response = await page.goto(INPUT.navigateTo, { waitUntil: 'domcontentloaded', timeout: 20000 });
  /*
    A 404 is not an account page with no cancel link on it. Searching one and
    then reporting "no cancellation control was reachable" would be a false
    accusation, so say the page was not there and let the caller try the next
    candidate.
  */
  const status = response ? response.status() : 0;
  if (status >= 400) {
    return { httpStatus: status, notFound: true, steps: 0, found: null, loginWall: false, exhausted: false, trail: [] };
  }
  await page.waitForTimeout(1500);
}

/** Look at the current page: is a cancel affordance here, and what leads onward? */
async function survey() {
  return await page.evaluate(() => {
    const CANCEL_EXACT = /\b(cancel\s+(subscription|membership|plan|auto[-\s]?renew)|unsubscribe|end\s+(membership|subscription)|close\s+account|turn\s+off\s+auto[-\s]?renew)\b/i;
    const CANCEL_LOOSE = /\b(cancel|unsubscribe|deactivate|terminate|stop\s+(plan|membership|subscription))\b/i;
    const VAGUE = /\b(manage|membership\s+settings|plan\s+settings|preferences|need\s+help|contact\s+us|more\s+options|manage\s+plan|help\s+centre|help\s+center|billing)\b/i;
    const ONWARD = /\b(subscription|membership|plan|billing|account|settings|prime|gold|plus|insider|one)\b/i;

    function describe(el) {
      const text = (el.innerText || el.getAttribute('aria-label') || el.value || '')
        .replace(/\s+/g, ' ')
        .trim();
      return text.slice(0, 90);
    }

    function visible(el) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 4 && r.height > 4 && s.display !== 'none' && s.visibility !== 'hidden';
    }

    const controls = Array.from(
      document.querySelectorAll('a[href], button, [role="button"], [role="link"], input[type="submit"]'),
    ).filter(visible);

    const direct = [];
    const vague = [];
    const onward = [];

    for (const el of controls) {
      const text = describe(el);
      if (!text) continue;
      const href = el.getAttribute('href') || null;

      if (CANCEL_EXACT.test(text)) {
        direct.push({ text, href, strength: 'exact' });
      } else if (CANCEL_LOOSE.test(text)) {
        // "Cancel" on a dialog's dismiss button is not a subscription exit.
        const isDismiss = /\b(cancel)\b/i.test(text) && text.length <= 8 && el.closest('[role="dialog"], form');
        if (!isDismiss) direct.push({ text, href, strength: 'loose' });
      } else if (VAGUE.test(text)) {
        vague.push({ text, href });
      }

      if (href && ONWARD.test(text + ' ' + href) && !href.startsWith('#') && !/logout|signout|sign-out/i.test(href)) {
        onward.push({ text, href });
      }
    }

    const dedupe = (list) => {
      const out = [];
      for (const item of list) {
        if (!out.some((o) => o.text === item.text && o.href === item.href)) out.push(item);
      }
      return out;
    };

    const bodyText = (document.body.innerText || '').slice(0, 4000);

    /*
      Two questions, and the charge depends on both.

      "Are we being asked to sign in?" must be generous: an Indian retailer's
      login is often a bare phone field with no password input at all, so
      requiring one misses the wall entirely.

      "Are we actually inside the account?" is the one that protects the
      defendant. A page with no cancel control is only evidence of a trap if we
      can show we were somewhere a cancel control belongs. Without that, the
      honest answer is that we could not tell.
    */
    const askedToSignIn =
      /\b(sign\s?in|log\s?in|signin|login|enter\s+(your\s+)?(otp|password|mobile|phone)|continue\s+with\s+(google|phone|email)|verify\s+(your\s+)?(mobile|number))\b/i.test(
        bodyText,
      ) ||
      /\/(login|signin|sign-in|auth|account\/login)/i.test(location.pathname) ||
      !!document.querySelector('input[type="password"], input[name*="otp" i]');

    const insideAccount =
      /\b(log\s?out|sign\s?out|logout|signout|my\s+orders|your\s+orders|order\s+history|manage\s+your\s+account)\b/i.test(
        bodyText,
      ) || !!document.querySelector('a[href*="logout" i], a[href*="signout" i], button[id*="logout" i]');

    return {
      url: location.href,
      title: document.title,
      direct: dedupe(direct).slice(0, 10),
      vague: dedupe(vague).slice(0, 10),
      onward: dedupe(onward).slice(0, 12),
      askedToSignIn,
      insideAccount,
      // Only a wall if it wants credentials and we are demonstrably not in.
      looksLikeLogin: askedToSignIn && !insideAccount,
    };
  });
}

const trail = [];
let depth = 0;
let found = null;
let loginWall = false;
/*
  A bot check is not a subscription page. When the body reads as a verification
  wall the run stops here and says so, rather than walking a captcha looking
  for a cancel button and reporting the captcha has none.
*/
let botCheck = false;
try {
  botCheck = await page.evaluate(() =>
    /captcha|not a robot|verify (that )?you are (a )?human|access denied|unusual traffic|automated access/i.test(
      (document.body?.innerText || '').slice(0, 4000),
    ),
  );
} catch {
  botCheck = false;
}
let provenInsideAccount = false;

while (depth <= MAX_DEPTH) {
  let view;
  try {
    view = await survey();
  } catch (err) {
    break;
  }

  trail.push({
    depth,
    url: view.url,
    title: view.title,
    directLabels: view.direct.map((d) => d.text),
    vagueLabels: view.vague.map((v) => v.text),
    insideAccount: view.insideAccount,
  });

  if (view.insideAccount) provenInsideAccount = true;

  if (view.looksLikeLogin) {
    loginWall = true;
    break;
  }

  if (view.direct.length > 0) {
    const best = view.direct.find((d) => d.strength === 'exact') || view.direct[0];
    found = { ...best, depth, url: view.url };
    break;
  }

  // Nothing here. Take the most promising onward link and go one level deeper.
  const next = view.onward.find((o) => /subscription|membership|plan|billing/i.test(o.text + o.href)) || view.onward[0];
  if (!next || depth === MAX_DEPTH) break;

  try {
    const target = new URL(next.href, view.url).toString();
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1200);
  } catch {
    break;
  }
  depth++;
}

return {
  startedAt: INPUT.navigateTo || null,
  steps: found ? found.depth + 1 : depth + 1,
  found,
  loginWall,
  provenInsideAccount,
  botCheck,
  exhausted: !found && !loginWall,
  trail,
};

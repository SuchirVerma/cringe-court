/**
 * Exhibit A, field work: find countdown-like and scarcity-like elements.
 *
 * Runs inside the page via webcmd. Returns candidates with a stable path so a
 * second reading can be matched against the first. Reads only; changes nothing.
 *
 * INPUT: {
 *   navigateTo?: string,
 *   scrollPasses?: number,      // deal grids that only render once scrolled
 *   namedSelectors?: [{ name, selector, kind }]
 * }
 *
 * `namedSelectors` is how a Tier 1 site contributes its own knowledge. The
 * general sweep below walks the whole page looking for urgency language, which
 * finds a claim only if it is worded the way the sweep expects. A named site
 * knows the exact element its stock line or deal timer lives in, so it can read
 * it directly and be certain it was read. Both paths produce the same candidate
 * shape, are deduplicated together, and are compared by the same code, so a
 * site profile adds reach without adding a second way to be right.
 *
 * Never `networkidle` here. Amazon holds connections open indefinitely, so it
 * never fires, and webcmd caps a single browser run at 30 seconds.
 */

if (INPUT.navigateTo) {
  await page.goto(INPUT.navigateTo, { waitUntil: 'domcontentloaded', timeout: 20000 });
  /*
    Give client-rendered timers a moment to mount and tick at least once.
    `settleMs` exists so a retry can wait longer than the first attempt did: a
    page that was still assembling itself is the commonest reason a first read
    comes back empty, and waiting is the cheapest thing to try next.
  */
  await page.waitForTimeout(INPUT.settleMs || 2500);
}

/*
  Deal grids are lazy: Amazon's /deals renders its nav on load and the actual
  deal cards only after the viewport moves. Measured on amazon.in/deals: 3.1k
  characters of body text before scrolling, 8.8k after. Without this the sweep
  reads a page of category links and honestly reports finding nothing.
*/
for (let i = 0; i < (INPUT.scrollPasses || 0); i++) {
  await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.9)));
  await page.waitForTimeout(900);
}
if (INPUT.scrollPasses) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
}

return await page.evaluate((named) => {
  const TIME_PATTERN = /\b\d{1,2}\s*:\s*\d{2}(\s*:\s*\d{2})?\b/;
  const URGENCY_WORDS =
    /\b(left|remaining|remain|expires?|expiring|ends?\s+in|ending|hurry|hurry\s+up|only\s+\d+|last\s+\d+|selling\s+fast|almost\s+gone|deal\s+ends|offer\s+ends|closes\s+in|time\s+left)\b/i;
  const UNIT_PATTERN = /\b\d+\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?)\b/i;
  const STOCK_PATTERN = /\bonly\s+(\d+)\s+(left|remaining|in stock)\b/i;

  /** A short, stable-ish path we can re-resolve on the second read. */
  function pathOf(el) {
    const parts = [];
    let node = el;
    let hops = 0;
    while (node && node.nodeType === 1 && node !== document.body && hops < 12) {
      const parent = node.parentElement;
      if (!parent) break;
      const tag = node.tagName.toLowerCase();
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
      const index = sameTag.indexOf(node) + 1;
      parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      node = parent;
      hops++;
    }
    return `body > ${parts.join(' > ')}`;
  }

  function visible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 6) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return Number(style.opacity || '1') > 0.1;
  }

  const seen = new Set();
  const candidates = [];

  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (candidates.length >= 25) break;
    if (!el.childNodes.length) continue;

    // Only leaf-ish nodes: the element whose own text carries the claim, not an
    // ancestor that happens to contain it.
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!ownText || ownText.length > 120) continue;

    /*
      The ticking digits are almost always in their own element, with the words
      that make them urgent in the parent: "Offer ends in <span>02:59</span>".
      Judging the span on its own text alone misses every real countdown, so a
      bare clock is checked against the sentence it sits inside.
    */
    const parentText = (el.parentElement?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200);

    const hasClock = TIME_PATTERN.test(ownText);
    const hasUnits = UNIT_PATTERN.test(ownText);
    const stockMatch = ownText.match(STOCK_PATTERN);
    const urgentHere = URGENCY_WORDS.test(ownText);
    const urgentNearby = hasClock && parentText.length <= 200 && URGENCY_WORDS.test(parentText);
    const hasUrgency = urgentHere || urgentNearby;

    // A bare clock alone is not enough (prices, durations and runtimes look the
    // same). It needs urgency language, either in its own text or around it.
    const isCandidate = (hasClock && (hasUrgency || hasUnits)) || (urgentHere && /\d/.test(ownText)) || !!stockMatch;
    if (!isCandidate) continue;
    if (!visible(el)) continue;

    const key = ownText.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      // `text` is what gets compared between readings; `context` is the sentence
      // a human should be shown in the evidence.
      text: ownText,
      context: urgentNearby && parentText ? parentText : ownText,
      path: pathOf(el),
      kind: hasClock ? 'clock' : stockMatch ? 'stock' : 'urgency-copy',
      numbers: (ownText.match(/\d+/g) || []).map(Number),
      stockCount: stockMatch ? Number(stockMatch[1]) : null,
      label: (el.getAttribute('aria-label') || el.className || '').toString().slice(0, 80) || null,
    });
  }

  /*
    The named surfaces a Tier 1 profile pointed us at. These are read whether or
    not they are worded like urgency, because the value of knowing a site is
    being able to say "we read the stock line itself", rather than "nothing on
    the page was phrased the way we look for".
  */
  const namedReadings = [];
  for (const entry of named || []) {
    let el = null;
    try {
      el = document.querySelector(entry.selector);
    } catch {
      continue; // A malformed selector in a profile must not stop the scan.
    }
    if (!el) {
      namedReadings.push({ name: entry.name, found: false, text: null });
      continue;
    }

    const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    namedReadings.push({ name: entry.name, found: true, text, visible: visible(el) });
    if (!text) continue;

    const stockMatch = text.match(STOCK_PATTERN);
    const hasClock = TIME_PATTERN.test(text);

    // Only worth comparing between readings if it carries a number that could move.
    if (!hasClock && !stockMatch && !/\d/.test(text)) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      text,
      context: text,
      // Named elements are re-resolved by their selector, not by a walked path,
      // so a re-render between readings cannot lose them.
      path: `named:${entry.name}`,
      selector: entry.selector,
      kind: hasClock ? 'clock' : stockMatch ? 'stock' : entry.kind || 'urgency-copy',
      numbers: (text.match(/\d+/g) || []).map(Number),
      stockCount: stockMatch ? Number(stockMatch[1]) : null,
      label: entry.name,
      viaProfile: true,
    });
  }

  return {
    url: location.href,
    title: document.title,
    /*
      How much page there actually was.

      A bot wall, an interstitial, or a render that never happened all produce
      zero candidates, which is indistinguishable from an honest page carrying
      no urgency claim. A clearance needs to know the difference, so it gets the
      body's own size to judge by.
    */
    textLength: (document.body.innerText || '').trim().length,
    readAt: Date.now(),
    candidates,
    namedReadings,
  };
}, INPUT.namedSelectors || []);

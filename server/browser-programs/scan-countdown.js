/**
 * Exhibit A, field work: find countdown-like and scarcity-like elements.
 *
 * Runs inside the page via webcmd. Returns candidates with a stable path so a
 * second reading can be matched against the first. Reads only; changes nothing.
 *
 * INPUT: { navigateTo?: string }
 */

if (INPUT.navigateTo) {
  await page.goto(INPUT.navigateTo, { waitUntil: 'domcontentloaded', timeout: 20000 });
  // Give client-rendered timers a moment to mount and tick at least once.
  await page.waitForTimeout(2500);
}

return await page.evaluate(() => {
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

    const hasClock = TIME_PATTERN.test(ownText);
    const hasUrgency = URGENCY_WORDS.test(ownText);
    const hasUnits = UNIT_PATTERN.test(ownText);
    const stockMatch = ownText.match(STOCK_PATTERN);

    // A bare clock alone is not enough (prices, durations, runtimes look similar).
    // Require either urgency language, or a clock plus a digit that can fall.
    const isCandidate = (hasClock && (hasUrgency || hasUnits)) || (hasUrgency && /\d/.test(ownText)) || !!stockMatch;
    if (!isCandidate) continue;
    if (!visible(el)) continue;

    const key = ownText.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      text: ownText,
      path: pathOf(el),
      kind: hasClock ? 'clock' : stockMatch ? 'stock' : 'urgency-copy',
      numbers: (ownText.match(/\d+/g) || []).map(Number),
      stockCount: stockMatch ? Number(stockMatch[1]) : null,
      label: (el.getAttribute('aria-label') || el.className || '').toString().slice(0, 80) || null,
    });
  }

  return {
    url: location.href,
    title: document.title,
    readAt: Date.now(),
    candidates,
  };
});

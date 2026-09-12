/**
 * Exhibit C, field work: pre-ticked checkboxes tied to a charge, and cart lines.
 *
 * The test is not "is anything ticked" — plenty of legitimate boxes start ticked.
 * The test is "is something ticked that costs money and that nobody chose".
 * So a candidate needs a checked control AND nearby price or charge language.
 *
 * Reads only. Never clicks, never submits.
 *
 * INPUT: { navigateTo?: string }
 */

if (INPUT.navigateTo) {
  await page.goto(INPUT.navigateTo, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
}

return await page.evaluate(() => {
  // Rupees first (this court sits in India), then the common others.
  const PRICE_PATTERN = /(₹|rs\.?\s|inr\s|\$|€|£)\s*\d[\d,]*(\.\d{1,2})?/i;
  const CHARGE_WORDS =
    /\b(insurance|protection|warranty|extended|donation|donate|charity|contribute|tip|packaging|gift\s*wrap|priority|express|membership|subscribe|subscription|auto[-\s]?renew|plan|add[-\s]?on|service\s+fee|handling)\b/i;

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
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    // A visually-hidden native checkbox behind a styled label still counts:
    // check the labelled ancestor instead of the input's own box.
    if (rect.width < 2 || rect.height < 2) {
      const host = el.closest('label, [class*="checkbox"], [class*="check"]');
      if (!host) return false;
      const hostRect = host.getBoundingClientRect();
      return hostRect.width > 6 && hostRect.height > 6;
    }
    return true;
  }

  /** Text in the neighbourhood of the control: its label, then widening ancestors. */
  function contextFor(el) {
    const chunks = [];
    if (el.id) {
      const labelled = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelled) chunks.push(labelled.innerText || '');
    }
    const ownLabel = el.closest('label');
    if (ownLabel) chunks.push(ownLabel.innerText || '');

    let node = el.parentElement;
    let hops = 0;
    while (node && hops < 4) {
      const text = (node.innerText || '').replace(/\s+/g, ' ').trim();
      if (text && text.length < 400) chunks.push(text);
      if (text.length > 60) break;
      node = node.parentElement;
      hops++;
    }

    // A label and its wrapper usually hold the same sentence. Quoting it twice
    // in the evidence reads as a bug, so keep only distinct chunks.
    const seenChunks = [];
    for (const chunk of chunks) {
      const normalised = chunk.replace(/\s+/g, ' ').trim();
      if (!normalised) continue;
      if (seenChunks.some((s) => s === normalised || s.includes(normalised))) continue;
      seenChunks.push(normalised);
    }
    return seenChunks.join(' | ').slice(0, 400);
  }

  const boxes = Array.from(
    document.querySelectorAll('input[type="checkbox"], [role="checkbox"], [role="switch"]'),
  );

  const preTicked = [];
  for (const el of boxes) {
    const checked =
      el.checked === true ||
      el.getAttribute('aria-checked') === 'true' ||
      el.hasAttribute('checked');
    if (!checked) continue;
    if (el.disabled) continue;
    if (!visible(el)) continue;

    const context = contextFor(el);
    const priceMatch = context.match(PRICE_PATTERN);
    const chargeMatch = context.match(CHARGE_WORDS);

    // Required-consent boxes (terms, privacy) are a different pattern entirely
    // and are not basket sneaking. Exclude them explicitly.
    const isConsent = /\b(terms|privacy|policy|conditions|age|18\s*\+|otp|remember\s+me)\b/i.test(context);
    if (isConsent) continue;

    if (!priceMatch && !chargeMatch) continue;

    preTicked.push({
      path: pathOf(el),
      name: el.getAttribute('name') || el.id || null,
      ariaLabel: el.getAttribute('aria-label') || null,
      context,
      price: priceMatch ? priceMatch[0].trim() : null,
      chargeWord: chargeMatch ? chargeMatch[0].toLowerCase() : null,
      hasPrice: !!priceMatch,
    });
  }

  // Cart line items, for the "appeared without being added" half of the charge.
  const lineSelectors = [
    '[data-testid*="cart-item"]',
    '[class*="cart-item"]',
    '[class*="CartItem"]',
    '[class*="basket-item"]',
    'li[class*="item"]',
  ];
  const lines = [];
  for (const selector of lineSelectors) {
    for (const el of Array.from(document.querySelectorAll(selector)).slice(0, 40)) {
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 300) continue;
      if (!PRICE_PATTERN.test(text)) continue;
      if (lines.some((l) => l.text === text)) continue;
      lines.push({ text: text.slice(0, 200), path: pathOf(el) });
    }
    if (lines.length) break;
  }

  /*
    Did we actually reach a basket?

    "Nothing pre-ticked" is only a clearance if there was somewhere for a
    pre-ticked box to be. Signed out, a cart URL serves a login page or an
    empty shell, and reporting that as clean clears a company on evidence we
    never saw. The caller needs to tell the two apart.
  */
  const pageText = (document.body.innerText || '').slice(0, 5000);
  const looksLikeCart =
    /\b(subtotal|order\s+summary|place\s+order|proceed\s+to\s+(pay|checkout|buy)|continue\s+to\s+payment|price\s+details|delivery\s+charges|total\s+amount|your\s+(cart|basket|bag))\b/i.test(
      pageText,
    ) || lines.length > 0;
  const looksEmpty =
    /\b((cart|basket|bag)\s+is\s+empty|no\s+items\s+in\s+your\s+(cart|basket|bag)|nothing\s+in\s+your\s+(cart|basket))\b/i.test(
      pageText,
    );

  return {
    url: location.href,
    title: document.title,
    checkboxesFound: boxes.length,
    preTicked,
    cartLines: lines.slice(0, 20),
    looksLikeCart,
    looksEmpty,
  };
});

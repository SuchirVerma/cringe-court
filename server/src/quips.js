/**
 * The comedy layer, and nothing but the comedy layer.
 *
 * Detection is rule-based and deterministic. These lines only dress a finding
 * that has already been made on the evidence. Selection is deterministic too —
 * keyed off the observed values, not a random draw — so the same page produces
 * the same line every run, and a demo is repeatable.
 *
 * Rule for writing more: state the observed fact first, then land the joke on it.
 * A line that would still read as funny with no evidence behind it is the wrong line.
 */

const QUIPS = {
  FALSE_URGENCY: [
    (d) =>
      `This timer said "${d.firstReading}". We waited ${d.waitedSeconds} seconds and looked again. Still "${d.secondReading}". Time is a construct, apparently.`,
    (d) =>
      `The countdown reset from "${d.firstReading}" to "${d.secondReading}" while we watched. That is not a deadline, that is a screensaver.`,
    (d) =>
      `"${d.firstReading}" it said, urgently. Then it said it again ${d.waitedSeconds} seconds later, with equal urgency. This clock needs therapy.`,
    (d) =>
      `We refreshed the page and the offer that was about to expire un-expired itself. Lazarus would like a word.`,
    (d) =>
      `${d.label ? `"${d.label}" ` : 'The scarcity badge '}claims the stock is nearly gone. It claimed the same thing before and after a reload. Schrödinger's warehouse.`,
  ],
  SUBSCRIPTION_TRAP: [
    (d) =>
      `It took ${d.steps} click${d.steps === 1 ? '' : 's'} to find the cancel button. Signing up took one. The maths is not subtle.`,
    (d) =>
      `We went ${d.steps} screen${d.steps === 1 ? '' : 's'} deep looking for "Cancel" and found "${d.labelFound}" instead. Creative writing, but not an answer.`,
    (d) =>
      `The cancellation option is ${d.steps} click${d.steps === 1 ? '' : 's'} from the subscription page. At that depth you are not cancelling, you are spelunking.`,
    (d) =>
      `Joining: one button, brightly coloured, above the fold. Leaving: ${d.steps} step${d.steps === 1 ? '' : 's'} and a scavenger hunt. Curious asymmetry.`,
  ],
  BASKET_SNEAKING: [
    (d) =>
      `A ${d.itemLabel ? `"${d.itemLabel}"` : 'add-on'} worth ${d.price || 'extra money'} was already ticked when we arrived. Nobody ticked it. It ticked itself.`,
    (d) =>
      `${d.count} pre-ticked box${d.count === 1 ? '' : 'es'} sitting next to a charge, checked before the consumer said a word. Consent by ambush.`,
    (d) =>
      `The cart helpfully pre-selected ${d.itemLabel ? `"${d.itemLabel}"` : 'an extra'} on our behalf. We would like to thank nobody for this.`,
    (d) =>
      `Default: ticked. Cost: ${d.price || 'not zero'}. Consumer's involvement in the decision: none. Bold interpretation of "opt in".`,
    (d) =>
      `An item appeared in the basket that we never added. The basket is writing its own shopping list now.`,
  ],
};

/**
 * Cover words for a charge nobody asked for. Kept in step with CHARGE_WORDS in
 * `browser-programs/scan-checkboxes.js`, which is what puts `chargeWord` on the
 * finding in the first place.
 */
const SOLD_AS_PROTECTION = /\b(insurance|protection|warranty|extended)\b/i;

/**
 * Deterministic index from the finding's own values, so the same evidence always
 * gets the same line.
 */
function pick(list, detail) {
  const seed = JSON.stringify(detail ?? {});
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

export function quipFor(chargeId, detail = {}) {
  /*
    When the search was exhausted there is no step count worth quoting, and a
    "it took N clicks" line would contradict the proof, which says no control
    was found at all. The absence is its own joke.
  */
  if (chargeId === 'SUBSCRIPTION_TRAP' && detail.exhausted) {
    return 'There is no cancel control anywhere in the subscription area. Not buried, not disguised. Simply absent.';
  }

  /*
    A cancellation five or more steps deep gets the line written for a search
    that absurd. Left in the ordinary rotation it surfaced on about one set of
    values in twenty and essentially never on the deep flows it describes, which
    is the wrong way round: the strongest evidence should get the hardest line.
  */
  if (chargeId === 'SUBSCRIPTION_TRAP' && Number(detail.steps) >= 5) {
    return (
      `${detail.steps} steps to the exit` +
      (detail.labelFound ? `, and the best label on offer is "${detail.labelFound}"` : '') +
      '. Finding the cancel button here is harder than finding a sober person at a wine tasting.'
    );
  }

  /*
    When the add-on is sold as protection, take the line written for exactly
    that. The deterministic pick below would otherwise scatter it across every
    kind of add-on, and "like a free sample at Costco" lands hardest on the
    insurance and warranty boxes it was written about.
  */
  if (chargeId === 'BASKET_SNEAKING' && SOLD_AS_PROTECTION.test(detail.chargeWord || '')) {
    const label = detail.itemLabel ? `"${detail.itemLabel}"` : detail.chargeWord;
    return `They added ${label} to your cart${detail.price ? ` at ${detail.price}` : ''} like it's a free sample at Costco. It's not.`;
  }

  const list = QUIPS[chargeId];
  if (!list || list.length === 0) return null;

  // Prefer a line whose required values are actually present, so we never render
  // "undefined" at the user. Fall back in order until one is safe.
  const ordered = [pick(list, detail), ...list];
  for (const template of ordered) {
    try {
      const line = template(detail);
      if (line && !line.includes('undefined') && !line.includes('null')) return line;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

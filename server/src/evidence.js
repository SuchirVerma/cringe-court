/**
 * The evidence schema, and the only three ways a check may end.
 *
 * Tier 1 and Tier 2 both produce these shapes, which is why the frontend never
 * needs to know which path ran. Construct findings only through these factories:
 * they are what guarantee every check resolves to a renderable card.
 */

import { chargeById, REMEDIES } from './law.js';
import { quipFor } from './quips.js';

export const OUTCOME = {
  VIOLATION: 'violation',
  CLEAR: 'clear',
  INCONCLUSIVE: 'inconclusive',
};

function base(chargeId, tier) {
  const charge = chargeById(chargeId);
  return {
    chargeId: charge.id,
    charge: charge.charge,
    exhibit: charge.exhibit,
    annexure: charge.annexure,
    definition: charge.definition,
    tier,
    at: new Date().toISOString(),
  };
}

/**
 * A violation. `proof` is the observational record: what was on the page, what
 * we did, and what happened next. It is rendered verbatim on the card, so it
 * must be factual and free of editorial.
 */
export function violation(chargeId, { tier, proof, confidence = 'high', detail = {} }) {
  const charge = chargeById(chargeId);
  return {
    ...base(chargeId, tier),
    outcome: OUTCOME.VIOLATION,
    confidence,
    proof,
    detail,
    quip: quipFor(chargeId, detail),
    harm: charge.harm,
    remedies: REMEDIES[chargeId] || [],
  };
}

/**
 * Checked properly, found nothing. A real result, not an absence of one.
 *
 * A clearance carries `detail` for the same reason a charge does: what was
 * examined is part of the finding. On a named site the run often leaves the
 * address it was handed, because the claims live elsewhere on that site, and a
 * clearance that cannot say where it looked is not worth much.
 */
export function clear(chargeId, { tier, proof, detail = {} }) {
  return {
    ...base(chargeId, tier),
    outcome: OUTCOME.CLEAR,
    confidence: 'high',
    proof,
    detail,
    quip: null,
    harm: null,
    remedies: [],
  };
}

/**
 * Could not reach a conclusion. `reason` is shown to the user, so it must say
 * what actually stopped us, never "something went wrong".
 */
export function inconclusive(chargeId, { tier, reason, proof = null, detail = {} }) {
  return {
    ...base(chargeId, tier),
    outcome: OUTCOME.INCONCLUSIVE,
    confidence: 'none',
    reason,
    proof,
    detail,
    quip: null,
    harm: null,
    remedies: [],
  };
}

/**
 * The last line of defence. Wraps a detector so that a thrown error, a rejected
 * promise, or an overrun clock still produces a valid finding instead of taking
 * the investigation down with it.
 */
export async function resolveAlways(chargeId, tier, fn, { timeout = 60_000 } = {}) {
  let timer;
  const clock = new Promise((resolve) => {
    timer = setTimeout(
      () =>
        resolve(
          inconclusive(chargeId, {
            tier,
            reason: `This check ran past ${Math.round(timeout / 1000)} seconds and was stopped`,
          }),
        ),
      timeout,
    );
  });

  try {
    const result = await Promise.race([fn(), clock]);
    if (!result || !result.outcome) {
      return inconclusive(chargeId, { tier, reason: 'The check returned no usable result' });
    }
    return result;
  } catch (err) {
    return inconclusive(chargeId, {
      tier,
      reason: `The check failed: ${err?.message || String(err)}`.slice(0, 240),
    });
  } finally {
    clearTimeout(timer);
  }
}

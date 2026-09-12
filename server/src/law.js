/**
 * The statute book.
 *
 * Source: Guidelines for Prevention and Regulation of Dark Patterns, 2023,
 * issued by the Central Consumer Protection Authority (CCPA) under section 18
 * of the Consumer Protection Act, 2019. Notified 30 November 2023.
 *
 * Annexure 1 of the guidelines specifies thirteen dark patterns. CringeCourt
 * charges three of them. The other ten are listed here because the verdict card
 * names what was NOT examined, which keeps the report honest.
 */

export const GUIDELINES = {
  citation: 'CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023',
  authority: 'Central Consumer Protection Authority, Government of India',
  notified: '2023-11-30',
  instrument: 'Consumer Protection Act, 2019, section 18',
};

/** The three we actually try. */
export const CHARGES = {
  FALSE_URGENCY: {
    id: 'FALSE_URGENCY',
    charge: 'False urgency',
    annexure: 'Annexure 1, clause 1',
    definition:
      'Falsely stating or implying a sense of urgency or scarcity so as to mislead a ' +
      'user into making an immediate purchase or taking an immediate action.',
    exhibit: 'Exhibit A',
    // What the visitor is being deprived of, in plain words, for the fix suggestions.
    harm: 'A decision made under a deadline that does not exist is not a free decision.',
  },
  SUBSCRIPTION_TRAP: {
    id: 'SUBSCRIPTION_TRAP',
    charge: 'Subscription trap',
    annexure: 'Annexure 1, clause 5',
    definition:
      'Making cancellation of a paid subscription impossible or complex, hiding the ' +
      'cancellation option, or requiring the consumer to take steps that are not ' +
      'required to subscribe in the first place.',
    exhibit: 'Exhibit B',
    harm: 'If leaving is harder than joining, the consent to stay was never really given.',
  },
  BASKET_SNEAKING: {
    id: 'BASKET_SNEAKING',
    charge: 'Basket sneaking',
    annexure: 'Annexure 1, clause 2',
    definition:
      'Addition of items such as products, services, payments to charity or donation ' +
      'at the time of checkout without the consent of the user, such that the total ' +
      'payable amount is more than what was to be paid at the time of confirmation.',
    exhibit: 'Exhibit C',
    harm: 'A charge the consumer did not choose is a charge the consumer did not agree to.',
  },
};

/** Named but not examined by this build. The verdict card discloses these. */
export const NOT_EXAMINED = [
  'Confirm shaming',
  'Forced action',
  'Interface interference',
  'Bait and switch',
  'Drip pricing',
  'Disguised advertisement',
  'Nagging',
  'Trick question',
  'SaaS billing',
  'Rogue malwares',
];

/**
 * Remedies offered on the verdict card. Practical, specific, and framed as what
 * a compliant version of the same page would do.
 */
export const REMEDIES = {
  FALSE_URGENCY: [
    'Drive the countdown from a real server-side deadline, or delete it.',
    'State the actual stock number when you claim scarcity, and let it go up as well as down.',
  ],
  SUBSCRIPTION_TRAP: [
    'Put "Cancel subscription" on the subscription page itself, at the same depth as "Upgrade".',
    'Match the exit to the entrance: if signing up took two clicks, cancelling takes two clicks.',
  ],
  BASKET_SNEAKING: [
    'Ship every optional add-on unticked. Let the consumer opt in, not notice and opt out.',
    'Show the total before and after any add-on, so the price change is visible at the moment it happens.',
  ],
};

export function chargeById(id) {
  const charge = CHARGES[id];
  if (!charge) throw new Error(`Unknown charge: ${id}`);
  return charge;
}

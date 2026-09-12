import type { Finding, Verdict } from './types';

/**
 * Sample findings for working on the interface without spending a live agent run.
 *
 * Development only: App refuses to render these unless import.meta.env.DEV is
 * true, and when it does it shows a banner saying so. A demo must be a real
 * execution, and nothing here may ever be mistaken for one.
 */

export const PREVIEW_FINDINGS: Finding[] = [
  {
    chargeId: 'FALSE_URGENCY',
    charge: 'False urgency',
    exhibit: 'Exhibit A',
    annexure: 'Annexure 1, clause 1',
    definition:
      'Falsely stating or implying a sense of urgency or scarcity so as to mislead a user into making an immediate purchase or taking an immediate action.',
    tier: 2,
    at: new Date().toISOString(),
    outcome: 'violation',
    confidence: 'high',
    proof:
      'At the first reading the element said "Offer ends in 02:59". After 6 seconds of real elapsed time it said "Offer ends in 02:59". The value did not fall. 1 other timer on this page did count down correctly, so this is not a page-wide rendering fault.',
    detail: {},
    quip:
      'This timer said "Offer ends in 02:59". We waited 6 seconds and looked again. Still "Offer ends in 02:59". Time is a construct, apparently.',
    harm: 'A decision made under a deadline that does not exist is not a free decision.',
    remedies: [
      'Drive the countdown from a real server-side deadline, or delete it.',
      'State the actual stock number when you claim scarcity, and let it go up as well as down.',
    ],
  },
  {
    chargeId: 'BASKET_SNEAKING',
    charge: 'Basket sneaking',
    exhibit: 'Exhibit C',
    annexure: 'Annexure 1, clause 2',
    definition:
      'Addition of items such as products, services, payments to charity or donation at the time of checkout without the consent of the user.',
    tier: 2,
    at: new Date().toISOString(),
    outcome: 'violation',
    confidence: 'high',
    proof:
      'On the checkout page, 1 checkbox was already ticked on arrival with a charge attached. The first reads: "Purchase Protection Plan — covers accidental damage for 12 months ₹149" and carries ₹149. No consumer action set this state.',
    detail: {},
    quip:
      'A "Purchase Protection Plan" worth ₹149 was already ticked when we arrived. Nobody ticked it. It ticked itself.',
    harm: 'A charge the consumer did not choose is a charge the consumer did not agree to.',
    remedies: [
      'Ship every optional add-on unticked. Let the consumer opt in, not notice and opt out.',
      'Show the total before and after any add-on, so the price change is visible at the moment it happens.',
    ],
  },
  {
    chargeId: 'SUBSCRIPTION_TRAP',
    charge: 'Subscription trap',
    exhibit: 'Exhibit B',
    annexure: 'Annexure 1, clause 5',
    definition:
      'Making cancellation of a paid subscription impossible or complex, hiding the cancellation option, or requiring steps not required to subscribe.',
    tier: 2,
    at: new Date().toISOString(),
    outcome: 'inconclusive',
    confidence: 'none',
    reason:
      'The subscription area is behind a sign-in wall. The cancellation flow cannot be examined without signing in, and this tool does not use accounts it was not given.',
    proof: null,
    detail: {},
    quip: null,
    harm: null,
    remedies: [],
  },
];

export const PREVIEW_VERDICT: Verdict = {
  url: 'https://example.com/checkout',
  host: 'example.com',
  tier: 2,
  siteName: null,
  guilty: true,
  headline: 'Guilty on two counts.',
  score: 4,
  ruled: true,
  determined: 2,
  outOf: 10,
  counts: { charges: 3, violations: 2, cleared: 0, inconclusive: 1 },
  remedies: PREVIEW_FINDINGS.filter((f) => f.outcome === 'violation').flatMap((f) =>
    f.remedies.map((text) => ({ charge: f.charge, exhibit: f.exhibit, text })),
  ),
  disclosure: {
    examined: ['False urgency', 'Basket sneaking', 'Subscription trap'],
    notExamined: [
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
    ],
    note: '1 of 3 charges could not be determined on this page. The score reflects only what was actually observed.',
  },
  citation: {
    citation: 'CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023',
    authority: 'Central Consumer Protection Authority, Government of India',
    notified: '2023-11-30',
    instrument: 'Consumer Protection Act, 2019, section 18',
  },
  durationMs: 41200,
};

export const PREVIEW_LOG = [
  { id: 0, level: 'info' as const, message: 'example.com is not on the court’s list of known sites. Running the general analysis.' },
  { id: 1, level: 'info' as const, message: 'Opening a browser session.' },
  { id: 2, level: 'info' as const, message: 'Exhibit A. Looking for countdowns and scarcity claims.' },
  { id: 3, level: 'info' as const, message: 'Exhibit A. Found 2 urgency claims. Waiting 6s to see if the clock actually moves.' },
  { id: 4, level: 'info' as const, message: 'Exhibit A. Charge filed. "Offer ends in 02:59" did not move in 6 seconds.' },
  { id: 5, level: 'info' as const, message: 'Exhibit C. Unfamiliar site, so looking for a cart the general way.' },
  { id: 6, level: 'info' as const, message: 'Exhibit C. Charge filed. 1 pre-ticked item with a cost attached.' },
  { id: 7, level: 'warn' as const, message: 'Exhibit B. Hit a sign-in wall. Cannot judge a cancellation flow we cannot enter.' },
  { id: 8, level: 'info' as const, message: 'The court has reached a verdict.' },
];

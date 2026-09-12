/**
 * The docket. Each charge is an independently testable module with the same
 * signature, so one can be run, fixed, or replaced without touching the others.
 */

import * as fakeUrgency from './fake-urgency.js';
import * as subscriptionTrap from './subscription-trap.js';
import * as basketSneaking from './basket-sneaking.js';

export const DOCKET = [
  { chargeId: 'FALSE_URGENCY', exhibit: 'Exhibit A', module: fakeUrgency, budgetMs: 75_000 },
  { chargeId: 'BASKET_SNEAKING', exhibit: 'Exhibit C', module: basketSneaking, budgetMs: 90_000 },
  { chargeId: 'SUBSCRIPTION_TRAP', exhibit: 'Exhibit B', module: subscriptionTrap, budgetMs: 120_000 },
];

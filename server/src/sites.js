/**
 * Tier 1 registry: the six named sites we demo on.
 *
 * Each entry carries seed knowledge (where the relevant surfaces live) and a slot
 * for the profile webcmd learns during exploration. The seed gets an investigation
 * moving on a cold machine; the learned profile is what makes the second run fast.
 *
 * A site is Tier 1 only if we have a profile for it. Everything else is Tier 2 and
 * runs the generic structural detectors. Adding a site here never changes the
 * evidence schema, so the frontend is unaffected.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(HERE, '..', 'site-profiles');

/**
 * Seed knowledge. Paths are starting points for exploration, not hard selectors:
 * the detectors resolve real elements at runtime. Nothing here is load-bearing
 * enough that a site redesign breaks the run — it degrades to Tier 2 behaviour.
 */
export const NAMED_SITES = {
  'amazon.in': {
    key: 'amazon.in',
    display: 'Amazon India',
    domains: ['amazon.in', 'www.amazon.in'],
    cartPaths: ['/gp/cart/view.html', '/cart'],
    accountPaths: ['/gp/css/homepage.html', '/gp/primecentral'],
    subscriptionPaths: ['/gp/primecentral', '/auto-deliveries'],
    urgencySurfaces: ['deal pages', 'product detail lightning deals'],
    notes: 'Lightning Deal timers and "Only N left in stock" are the urgency surfaces.',

    /*
      Urgency knowledge, from actually driving the site on 2026-09-12.

      The homepage carries no urgency claim at all, so landing on amazon.in and
      reporting "nothing found" would be true about that page and useless about
      the site. The claims live on the deal grid and on product pages, so that
      is where a Tier 1 run goes.

      The deal grid is lazy: it renders category navigation on load and the deal
      cards only once the viewport moves, which is what scrollPasses is for.
    */
    urgency: {
      surface: '/deals',
      scrollPasses: 4,
      // Read directly, rather than hoped for in a text sweep.
      selectors: [
        { name: 'availability', selector: '#availability', kind: 'stock' },
        {
          name: 'deal-badge',
          selector: '#dealBadgeSupportingText, .dealBadgeSupportingText',
          kind: 'urgency-copy',
        },
        { name: 'deal-block', selector: '#dealBadge_feature_div', kind: 'urgency-copy' },
      ],
      // These pages are already somewhere urgency lives: never redirect off them.
      keepPathPatterns: ['/dp/', '/gp/product/', '/deal/', '/deals', '/gp/goldbox', '/events/'],
    },
  },
  'flipkart.com': {
    key: 'flipkart.com',
    display: 'Flipkart',
    domains: ['flipkart.com', 'www.flipkart.com'],
    cartPaths: ['/viewcart'],
    accountPaths: ['/account'],
    subscriptionPaths: ['/plus', '/account/subscriptions'],
    urgencySurfaces: ['Big Billion / deal countdowns', 'stock-left ribbons'],
    notes: 'Cart routinely carries a pre-selected protection plan. Prime basket-sneaking ground.',
  },
  'myntra.com': {
    key: 'myntra.com',
    display: 'Myntra',
    domains: ['myntra.com', 'www.myntra.com'],
    cartPaths: ['/checkout/cart'],
    accountPaths: ['/my/profile'],
    subscriptionPaths: ['/my/insider'],
    urgencySurfaces: ['end-of-reason-sale banners', 'few-left badges'],
    notes: 'Cart offers donation and packaging add-ons; check their default state.',
  },
  'zomato.com': {
    key: 'zomato.com',
    display: 'Zomato',
    domains: ['zomato.com', 'www.zomato.com'],
    cartPaths: ['/cart'],
    accountPaths: ['/profile'],
    subscriptionPaths: ['/gold', '/district/gold'],
    urgencySurfaces: ['offer-expiry strips', 'delivery-time pressure'],
    notes: 'Feeding India donation line and Gold renewal are the surfaces of interest.',
  },
  'swiggy.com': {
    key: 'swiggy.com',
    display: 'Swiggy',
    domains: ['swiggy.com', 'www.swiggy.com'],
    cartPaths: ['/checkout'],
    accountPaths: ['/my-account'],
    subscriptionPaths: ['/one'],
    urgencySurfaces: ['coupon countdowns', 'surge messaging'],
    notes: 'Checkout adds tips, donations and platform fees. Watch defaults, not presence.',
  },
  'bookmyshow.com': {
    key: 'bookmyshow.com',
    display: 'BookMyShow',
    domains: ['bookmyshow.com', 'in.bookmyshow.com'],
    cartPaths: ['/checkout'],
    accountPaths: ['/accounts'],
    subscriptionPaths: ['/accounts/subscriptions'],
    urgencySurfaces: ['seat-hold timers (legitimate)', 'fast-filling badges'],
    notes:
      'Seat-hold timers are genuine inventory locks. The detector must not cry wolf ' +
      'on a timer that actually counts down and actually expires.',
  },
};

/** Strip a URL down to a registrable-ish host we can match on. */
export function hostOf(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Resolve a URL to its tier.
 * Returns { tier: 1, site } for a named site, { tier: 2, site: null } otherwise.
 */
export function resolveTier(rawUrl) {
  const host = hostOf(rawUrl);
  if (!host) return { tier: 2, site: null, host: null };

  for (const site of Object.values(NAMED_SITES)) {
    const hit = site.domains.some(
      (d) => host === d.replace(/^www\./, '') || host.endsWith(`.${d.replace(/^www\./, '')}`),
    );
    if (hit) return { tier: 1, site, host };
  }
  return { tier: 2, site: null, host };
}

/** Load the webcmd-learned profile for a site, if one has been built. */
export async function loadProfile(siteKey) {
  const file = path.join(PROFILE_DIR, `${siteKey}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // A corrupt profile must never block an investigation. Fall back to seed knowledge.
    return null;
  }
}

/** Persist what an exploration run learned about a site. */
export async function saveProfile(siteKey, profile) {
  await mkdir(PROFILE_DIR, { recursive: true });
  const file = path.join(PROFILE_DIR, `${siteKey}.json`);
  const payload = { ...profile, siteKey, learnedAt: new Date().toISOString() };
  await writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

/**
 * Exploration: let the browser tell us what a named site actually looks like,
 * and keep it.
 *
 * Seed knowledge in `sites.js` is what a developer believed on the day they
 * wrote it. This is what the site really did when a browser last visited, and
 * it is what an investigation loads instead of the seed. A site redesign then
 * costs one exploration run, not a code change.
 *
 * It is deliberately not part of an investigation. Exploring takes tens of
 * seconds and a trial should be fast, so this runs out of band
 * (`npm run explore -- amazon.in`) and every investigation after it is quick.
 *
 * Like everything else here it is total: it resolves, and a site that refuses
 * to be explored yields a profile saying so rather than throwing.
 */

import { NAMED_SITES, saveProfile } from './sites.js';
import * as webcmd from './webcmd.js';

/**
 * Probe one surface and report what urgency machinery is on it.
 *
 * `scrollPasses` matters more than it looks: deal grids render their navigation
 * on load and their actual cards only once the viewport moves, so an unscrolled
 * read of a deal page honestly reports an empty grid.
 */
async function probe(sessionId, origin, path, knowledge) {
  const result = await webcmd.runProgram(sessionId, 'scan-countdown', {
    navigateTo: origin + path,
    scrollPasses: knowledge.scrollPasses || 0,
    namedSelectors: knowledge.selectors || [],
  });

  if (!result.ok) {
    return { path, reachable: false, reason: result.reason };
  }

  const candidates = result.data.candidates || [];
  const named = result.data.namedReadings || [];

  return {
    path,
    reachable: true,
    landedOn: result.data.url || null,
    title: (result.data.title || '').slice(0, 80),
    candidateCount: candidates.length,
    kinds: [...new Set(candidates.map((c) => c.kind))],
    // A couple of real examples, so a human reading the profile can tell at a
    // glance whether it is still describing the site they know.
    samples: candidates.slice(0, 3).map((c) => ({ kind: c.kind, text: c.text.slice(0, 90) })),
    namedSelectorsFound: named.filter((n) => n.found).map((n) => ({ name: n.name, text: (n.text || '').slice(0, 90) })),
    namedSelectorsMissing: named.filter((n) => !n.found).map((n) => n.name),
  };
}

/**
 * Explore one named site and save what was learned.
 * Resolves { ok, profile, reason } and never throws.
 */
export async function exploreSite(siteKey, { log = () => {} } = {}) {
  const site = NAMED_SITES[siteKey];
  if (!site) return { ok: false, profile: null, reason: `${siteKey} is not a named site` };

  const engine = await webcmd.available();
  if (!engine.ok) return { ok: false, profile: null, reason: `webcmd unavailable: ${engine.reason}` };

  const session = await webcmd.createSession(`explore-${siteKey.replace(/\./g, '-')}`);
  if (!session.ok) return { ok: false, profile: null, reason: session.reason };

  const origin = `https://www.${siteKey}`;
  const knowledge = site.urgency || {};
  const paths = ['/', knowledge.surface].filter(Boolean);

  const surfaces = [];
  try {
    for (const path of paths) {
      log(`Exploring ${origin}${path}`);
      const seen = await probe(session.sessionId, origin, path, knowledge);
      surfaces.push(seen);
      log(
        seen.reachable
          ? `  ${seen.candidateCount} urgency candidate(s); read ${seen.namedSelectorsFound.length} named element(s)`
          : `  unreachable: ${seen.reason}`,
      );
    }
  } finally {
    await webcmd.closeSession(session.sessionId);
  }

  const withClaims = surfaces.filter((s) => s.reachable && s.candidateCount > 0);

  const profile = await saveProfile(siteKey, {
    display: site.display,
    // Carried forward so an investigation can load this file alone and know
    // both where to go and what to read once there.
    urgency: {
      ...knowledge,
      // The best surface found, falling back to the seed's.
      surface: withClaims[0]?.path || knowledge.surface || null,
    },
    explored: {
      surfaces,
      // The headline finding, in a form a human can read.
      summary: withClaims.length
        ? `Urgency claims present on ${withClaims.map((s) => s.path).join(', ')}.`
        : 'No countdown or scarcity claim was displayed on any surface explored.',
    },
  });

  return { ok: true, profile, reason: null };
}

// `node src/explore.js amazon.in`
if (process.argv[1] && process.argv[1].endsWith('explore.js')) {
  const key = process.argv[2];
  if (!key) {
    console.error('Usage: node src/explore.js <site-key>   (e.g. amazon.in)');
    process.exit(1);
  }
  const res = await exploreSite(key, { log: (m) => console.log(m) });
  if (!res.ok) {
    console.error(`Could not explore ${key}: ${res.reason}`);
    process.exit(1);
  }
  console.log(`\nSaved site-profiles/${key}.json`);
  console.log(res.profile.explored.summary);
}

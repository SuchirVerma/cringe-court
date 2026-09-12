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

  const textLength = result.data.textLength ?? null;

  return {
    path,
    reachable: true,
    landedOn: result.data.url || null,
    title: (result.data.title || '').slice(0, 80),
    textLength,
    /*
      Reachable is not the same as rendered. Swiggy's /offers answers 200 with
      92 characters: a single-page app shell that never hydrated for us. A
      profile that picks it as the urgency surface sends every later run to a
      blank page and gets "unproven, almost no content" for ever. So record how
      much actually came back, and let the surface choice below insist on a page
      with something on it.
    */
    substantive: textLength !== null && textLength >= 600,
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
  /*
    A seed may name one surface it is confident about, or several candidates it
    is not. Probing all of them and keeping whichever actually carried a claim
    is the difference between a guess in the source and something learned, and
    it is cheap: a surface that 404s costs one navigation.
  */
  const candidates = knowledge.surfaces || [knowledge.surface].filter(Boolean);
  const paths = [...new Set(['/', ...candidates])].slice(0, 4);

  const surfaces = [];
  let carts = [];
  let accounts = [];
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

    carts = await probeCarts(session.sessionId, origin, site, log);
    accounts = await probeAccounts(session.sessionId, origin, site, log);
  } finally {
    await webcmd.closeSession(session.sessionId);
  }

  const withClaims = surfaces.filter((s) => s.reachable && s.candidateCount > 0);

  /*
    Ordering is the learning.

    Seed paths are a developer's guess in a fixed order. Exploration turns that
    into an order that reflects what the site actually does: a cart address that
    resolved goes ahead of one that 404s, and a subscription page we reached
    goes ahead of one we never saw. The detectors try these in order and stop
    early, so a good order is most of the speed-up on a repeat run.

    Nothing is dropped, only ranked. A page that 404s today may be a redesign
    away from working, and a profile that deleted it would never find it again.
  */
  const profile = await saveProfile(siteKey, {
    display: site.display,
    // Carried forward so an investigation can load this file alone and know
    // both where to go and what to read once there.
    urgency: {
      ...knowledge,
      /*
        The surface that actually carried a claim wins. Failing that, the first
        candidate that was at least reachable, so a later run still starts
        somewhere real rather than on a 404. The homepage is the last resort,
        and only because it is the one page every site has.
      */
      surface:
        withClaims[0]?.path ||
        // A page that actually rendered, in preference to one that merely
        // answered. An empty app shell is worse than the homepage.
        surfaces.find((s) => s.substantive && s.path !== '/')?.path ||
        surfaces.find((s) => s.substantive)?.path ||
        knowledge.surface ||
        candidates[0] ||
        null,
      // Kept so a re-exploration can try the whole list again after a redesign.
      surfaces: candidates,
    },
    cartPaths: rank(carts, site.cartPaths),
    subscriptionPaths: rank(accounts, site.subscriptionPaths),
    accountPaths: rank(accounts, site.accountPaths),
    /*
      The one ordering that actually saves a run.

      Ranking each list on its own achieves nothing when a list holds a single
      path: Myntra's only subscription address is /my/insider, it 404s, and
      ranking it against itself leaves it first. The detector tries subscription
      addresses before account ones, so it spends its first navigation on a page
      exploration already knows is not there.

      This is the union of everything probed, in the order worth trying: the
      pages that opened, then the ones that did not. Nothing is dropped, because
      a 404 today may be a redesign away from working.
    */
    accountSearchOrder: [
      ...accounts.filter((a) => a.worked && !a.loginWall).map((a) => a.path),
      ...accounts.filter((a) => a.worked && a.loginWall).map((a) => a.path),
      ...accounts.filter((a) => !a.worked).map((a) => a.path),
    ],
    explored: {
      surfaces,
      carts,
      accounts,
      // The headline finding, in a form a human can read.
      summary: [
        withClaims.length
          ? `Urgency claims present on ${withClaims.map((s) => s.path).join(', ')}.`
          : 'No countdown or scarcity claim was displayed on any surface explored.',
        carts.some((c) => c.isCart)
          ? `Cart reachable at ${carts.filter((c) => c.isCart).map((c) => c.path).join(', ')}.`
          : 'No cart page presented as a basket while signed out.',
        accounts.some((a) => a.reachable && !a.notFound)
          ? `Account area reachable at ${accounts.filter((a) => a.reachable && !a.notFound).map((a) => a.path).join(', ')}` +
            `${accounts.some((a) => a.loginWall) ? ', behind a sign-in wall.' : '.'}`
          : 'No account or subscription page could be opened.',
      ].join(' '),
    },
  });

  return { ok: true, profile, reason: null };
}

/**
 * Put the paths that actually resolved first, keeping the rest behind them.
 * `seen` entries carry `path` and a `worked` flag; `seed` is the original list.
 */
function rank(seen, seed = []) {
  const worked = seen.filter((s) => s.worked).map((s) => s.path);
  const rest = (seed || []).filter((p) => !worked.includes(p));
  return [...worked.filter((p) => (seed || []).includes(p)), ...rest];
}

/** Which of the site's cart addresses actually open, and which show a basket. */
async function probeCarts(sessionId, origin, site, log) {
  const out = [];
  for (const path of (site.cartPaths || []).slice(0, 3)) {
    log(`Exploring cart ${origin}${path}`);
    const res = await webcmd.runProgram(sessionId, 'scan-checkboxes', { navigateTo: origin + path });
    const shaped = res.ok && res.data && Array.isArray(res.data.preTicked);

    const entry = {
      path,
      reachable: res.ok,
      readable: !!shaped,
      isCart: !!(shaped && res.data.looksLikeCart),
      looksEmpty: !!(shaped && res.data.looksEmpty),
      checkboxes: shaped ? res.data.checkboxesFound : null,
      preTicked: shaped ? res.data.preTicked.length : null,
      reason: res.ok ? null : res.reason,
      // A path is "working" if we could read it at all. Signed out, an empty
      // basket is still proof the address is the basket.
      worked: !!shaped,
    };
    out.push(entry);
    log(
      entry.readable
        ? `  ${entry.isCart ? 'presents as a basket' : 'readable, not a basket'}${entry.looksEmpty ? ' (empty)' : ''}; ${entry.checkboxes} checkbox(es)`
        : `  unreadable: ${entry.reason || 'no cart structure'}`,
    );
    if (entry.isCart && !entry.looksEmpty) break; // Found the real thing.
  }
  return out;
}

/** Which of the site's account and subscription addresses open, and what guards them. */
async function probeAccounts(sessionId, origin, site, log) {
  const paths = [...new Set([...(site.subscriptionPaths || []), ...(site.accountPaths || [])])].slice(0, 4);
  const out = [];
  for (const path of paths) {
    log(`Exploring account ${origin}${path}`);
    const res = await webcmd.runProgram(sessionId, 'scan-cancel-flow', {
      navigateTo: origin + path,
      maxDepth: 2, // Shallow: exploration maps the door, the detector walks the corridor.
    });
    const shaped = res.ok && res.data && typeof res.data === 'object' && Array.isArray(res.data.trail);

    const entry = {
      path,
      reachable: res.ok,
      readable: !!shaped,
      notFound: !!(shaped && res.data.notFound),
      httpStatus: shaped ? res.data.httpStatus ?? null : null,
      loginWall: !!(shaped && res.data.loginWall),
      foundCancel: !!(shaped && res.data.found),
      reason: res.ok ? null : res.reason,
      worked: !!(shaped && !res.data.notFound),
    };
    out.push(entry);
    log(
      entry.readable
        ? entry.notFound
          ? `  not there (${entry.httpStatus})`
          : `  opened${entry.loginWall ? ', sign-in wall' : ''}${entry.foundCancel ? ', cancel control visible' : ''}`
        : `  unreadable: ${entry.reason || 'no navigation structure'}`,
    );
  }
  return out;
}

// `node src/explore.js amazon.in`, or `node src/explore.js all`
if (process.argv[1] && process.argv[1].endsWith('explore.js')) {
  const key = process.argv[2];
  if (!key) {
    console.error('Usage: node src/explore.js <site-key|all>   (e.g. amazon.in)');
    process.exit(1);
  }

  const keys = key === 'all' ? Object.keys(NAMED_SITES) : [key];
  let failed = 0;

  for (const k of keys) {
    if (keys.length > 1) console.log(`\n${'='.repeat(50)}\n${k}\n${'='.repeat(50)}`);
    const res = await exploreSite(k, { log: (m) => console.log(m) });
    if (!res.ok) {
      // One site refusing to be explored must not abandon the other five.
      console.error(`Could not explore ${k}: ${res.reason}`);
      failed++;
      continue;
    }
    console.log(`\nSaved site-profiles/${k}.json`);
    console.log(res.profile.explored.summary);
  }

  if (failed) console.error(`\n${failed} of ${keys.length} site(s) could not be explored.`);
  process.exit(failed && keys.length === 1 ? 1 : 0);
}

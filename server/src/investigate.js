/**
 * The trial.
 *
 * Opens one browser session, runs every charge on the docket through the
 * always-resolves wrapper, streams the reasoning out as it goes, and delivers a
 * verdict. The session is closed in a finally block: a thrown error anywhere
 * above must not leave a browser running on the user's machine.
 */

import { resolveTier, loadProfile, hostOf } from './sites.js';
import { DOCKET } from './detectors/index.js';
import { resolveAlways } from './evidence.js';
import { buildVerdict } from './verdict.js';
import * as webcmd from './webcmd.js';

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function normaliseUrl(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

    const host = u.hostname.toLowerCase();
    // A dot is the common case, but not the only legitimate host: localhost and
    // bare IPs are how the fixture site and any intranet target are addressed.
    const routable =
      host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || IPV4.test(host) || host.startsWith('[');
    if (!routable) return null;

    return u.toString();
  } catch {
    return null;
  }
}

/**
 * @param {string} rawUrl
 * @param {(event: {type: string, [k: string]: any}) => void} emit
 */
export async function investigate(rawUrl, emit) {
  const startedAt = new Date().toISOString();
  const url = normaliseUrl(rawUrl);

  const log = (message, level = 'info') => emit({ type: 'log', level, message, at: Date.now() });

  if (!url) {
    emit({ type: 'error', message: 'That does not look like a web address. Try something like flipkart.com.' });
    return;
  }

  const { tier, site, host } = resolveTier(url);
  emit({ type: 'opened', url, host, tier, siteName: site?.display ?? null });

  // The "learned vs exploring fresh" moment, surfaced deliberately.
  let profile = null;
  if (tier === 1) {
    profile = await loadProfile(site.key);
    log(
      profile
        ? `Recognised ${site.display}. Loading the learned site profile from ${new Date(profile.learnedAt).toLocaleDateString()}.`
        : `Recognised ${site.display}. No learned profile yet, so exploring it fresh and keeping what is useful.`,
    );
  } else {
    log(`${host} is not on the court's list of known sites. Running the general analysis.`);
  }

  const availability = await webcmd.available();
  if (!availability.ok) {
    emit({
      type: 'error',
      message:
        'The browser engine (webcmd) is not available on this machine. Install it with ' +
        '`npm install -g @agentrhq/webcmd`, then try again.',
      detail: availability.reason,
    });
    return;
  }

  log('Opening a browser session.');
  const session = await webcmd.createSession(host ? host.replace(/\./g, '-') : 'case');
  if (!session.ok) {
    emit({ type: 'error', message: `Could not open a browser: ${session.reason}` });
    return;
  }
  log(`Session ${session.sessionId} open. Court is in session.`);

  const findings = [];
  try {
    for (const item of DOCKET) {
      emit({ type: 'charge-start', chargeId: item.chargeId, exhibit: item.exhibit });

      const finding = await resolveAlways(
        item.chargeId,
        tier,
        () =>
          item.module.detect({
            sessionId: session.sessionId,
            url,
            tier,
            site,
            profile,
            log,
          }),
        { timeout: item.budgetMs },
      );

      findings.push(finding);
      emit({ type: 'finding', finding });

      if (finding.outcome === 'inconclusive') {
        log(`${item.exhibit}. Unable to reach a finding. ${finding.reason}`, 'warn');
      }
    }
  } finally {
    log('Closing the browser session.');
    const closed = await webcmd.closeSession(session.sessionId);
    if (!closed.ok) log(`The browser session did not close cleanly: ${closed.reason}`, 'warn');
  }

  const verdict = buildVerdict({ url, host, tier, site, findings, startedAt });
  log('The court has reached a verdict.');
  emit({ type: 'verdict', verdict });
}

export { hostOf };

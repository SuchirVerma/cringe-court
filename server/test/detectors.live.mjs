/**
 * End-to-end detector test against the local fixture site.
 *
 * Requires three things running:
 *   1. the fixture site   — cd server/test-site && python3 -m http.server 8080
 *   2. the API            — cd server && npm start
 *   3. webcmd             — a working browser bridge (webcmd doctor)
 *
 * The fixture has known answers, so this is pass/fail rather than a judgement
 * call. It also asserts the two false-positive traps: the honest countdown next
 * to the fake one must NOT be charged, and the ticked terms box must NOT be
 * read as basket sneaking.
 *
 * Run: node test/detectors.live.mjs
 */

const API = process.env.API || 'http://localhost:8787';
const TARGET = process.env.TARGET || 'http://localhost:8080/index.html';

const EXPECTED = {
  FALSE_URGENCY: 'violation', // #fake-timer never moves
  BASKET_SNEAKING: 'violation', // pre-ticked ₹149 protection plan
  SUBSCRIPTION_TRAP: 'violation', // cancel is four links deep
};

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    pass++;
    console.log(`  ok    ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

async function run() {
  console.log(`Investigating ${TARGET}\n`);

  const res = await fetch(`${API}/api/investigate?url=${encodeURIComponent(TARGET)}`);
  if (!res.ok) throw new Error(`API returned ${res.status}. Is the server running?`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const findings = [];
  const logs = [];
  let verdict = null;
  let error = null;

  outer: for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      const event = JSON.parse(line.slice(6));

      if (event.type === 'log') {
        logs.push(event.message);
        console.log(`  · ${event.message}`);
      } else if (event.type === 'finding') {
        findings.push(event.finding);
      } else if (event.type === 'verdict') {
        verdict = event.verdict;
      } else if (event.type === 'error') {
        error = event.message;
      } else if (event.type === 'done') {
        break outer;
      }
    }
  }

  console.log('\nResults');

  if (error) {
    check('investigation completed without a fatal error', false, error);
  } else {
    check('investigation completed without a fatal error', true);
  }

  // The hard requirement: three charges, all resolved, whatever happened.
  check('all three charges resolved', findings.length === 3, `got ${findings.length}`);
  check(
    'every finding has a valid outcome',
    findings.every((f) => ['violation', 'clear', 'inconclusive'].includes(f.outcome)),
  );
  check('a verdict was delivered', verdict !== null);

  for (const [chargeId, want] of Object.entries(EXPECTED)) {
    const got = findings.find((f) => f.chargeId === chargeId);
    check(
      `${chargeId} → ${want}`,
      got?.outcome === want,
      got ? `got ${got.outcome}${got.reason ? `: ${got.reason}` : ''}` : 'no finding',
    );
  }

  // False-positive traps.
  const urgency = findings.find((f) => f.chargeId === 'FALSE_URGENCY');
  if (urgency?.outcome === 'violation') {
    check(
      'charged the frozen timer, not the honest one',
      /02:59/.test(urgency.proof || ''),
      `proof cites: ${(urgency.proof || '').slice(0, 120)}`,
    );
    check(
      'noticed the honest timer counting down',
      /count down correctly|did count down/.test(urgency.proof || ''),
    );
  }

  const basket = findings.find((f) => f.chargeId === 'BASKET_SNEAKING');
  if (basket?.outcome === 'violation') {
    check(
      'charged the protection plan, not the terms box',
      /protection/i.test(basket.proof || '') && !/terms|privacy/i.test(basket.proof || ''),
      `proof cites: ${(basket.proof || '').slice(0, 120)}`,
    );
  }

  // Read-only guarantee: the fixture's cancellation page must never be reached.
  check(
    'never opened the cancellation page',
    !logs.some((l) => /cancelled\.html/.test(l)) &&
      !findings.some((f) => /cancelled\.html/.test(f.proof || '')),
  );

  if (verdict) {
    console.log(`\n  Verdict: ${verdict.headline} ${verdict.score}/${verdict.outOf}`);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

run().catch((err) => {
  console.error(`\nHarness failed: ${err.message}`);
  process.exit(1);
});

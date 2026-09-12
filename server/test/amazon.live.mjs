/**
 * Tier 1 live test: Amazon India, Exhibit A only.
 *
 * This one cannot assert an outcome the way the fixture test does, because it
 * runs against a real site that changes hourly. Amazon may or may not be running
 * a countdown on the day you run this, and asserting "violation" would make the
 * suite a weather report.
 *
 * So it asserts what must be true every time, whatever Amazon is doing:
 *
 *   - the URL routes to Tier 1 and the learned profile loads
 *   - the run goes to the deal grid instead of scanning the homepage
 *   - a product URL is read where it stands, not redirected away from
 *   - Exhibit A resolves to one of the three outcomes, never a crash or a hang
 *   - a clearance explains where it looked, not just that it found nothing
 *   - nothing was bought, added to a basket, or cancelled
 *
 * Requires the API running (npm start) and webcmd working (webcmd doctor).
 * Run: npm run test:amazon
 */

const API = process.env.API || 'http://localhost:8787';

// A product page and the bare domain: the two shapes the surface logic must
// tell apart. The ASIN is a long-lived listing, but if it ever 404s the test
// still passes on "resolved without crashing", which is the real contract.
const CASES = [
  {
    name: 'bare domain',
    url: 'https://www.amazon.in',
    expectRedirect: true,
  },
  {
    name: 'product page',
    url: 'https://www.amazon.in/dp/B08LHTJTBB',
    expectRedirect: false,
  },
];

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

async function investigate(url) {
  const res = await fetch(`${API}/api/investigate?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`API returned ${res.status}. Is the server running?`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const logs = [];
  const findings = [];
  let opened = null;
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
      } else if (event.type === 'opened') {
        opened = event;
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

  return { logs, findings, opened, verdict, error };
}

for (const testCase of CASES) {
  console.log(`\n=== ${testCase.name}: ${testCase.url} ===\n`);

  const started = Date.now();
  const { logs, findings, opened, verdict, error } = await investigate(testCase.url);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\n  (${seconds}s)\n`);

  check(`${testCase.name}: no fatal error`, !error, error || '');
  check(`${testCase.name}: routed to Tier 1`, opened?.tier === 1, `tier ${opened?.tier}`);
  check(
    `${testCase.name}: recognised as Amazon India`,
    opened?.siteName === 'Amazon India',
    String(opened?.siteName),
  );
  check(
    `${testCase.name}: loaded the learned profile`,
    logs.some((l) => /learned site profile/i.test(l)),
    'expected the profile line in the log',
  );

  const urgency = findings.find((f) => f.chargeId === 'FALSE_URGENCY');
  check(`${testCase.name}: Exhibit A resolved`, !!urgency, 'no finding for FALSE_URGENCY');
  check(
    `${testCase.name}: outcome is one of the three`,
    ['violation', 'clear', 'inconclusive'].includes(urgency?.outcome),
    String(urgency?.outcome),
  );

  // The point of Tier 1: look where the claims live, not at whatever was pasted.
  const wentToDeals = logs.some((l) => /keeps its urgency claims on/i.test(l));
  check(
    testCase.expectRedirect
      ? `${testCase.name}: went to the deal grid instead of the homepage`
      : `${testCase.name}: read the product page where it stands`,
    testCase.expectRedirect ? wentToDeals : !wentToDeals,
    `redirect log ${wentToDeals ? 'present' : 'absent'}`,
  );

  // A clearance has to be worth something.
  if (urgency?.outcome === 'clear') {
    check(
      `${testCase.name}: the clearance says where it looked`,
      /scanned|went to/i.test(urgency.proof || '') && (urgency.proof || '').length > 60,
      `proof: ${(urgency.proof || '').slice(0, 100)}`,
    );
  }
  if (urgency?.outcome === 'violation') {
    check(
      `${testCase.name}: the charge quotes both readings`,
      /first reading/i.test(urgency.proof || '') && /seconds/i.test(urgency.proof || ''),
      `proof: ${(urgency.proof || '').slice(0, 100)}`,
    );
  }

  // Observation only. Nothing in the log may suggest we acted on the site.
  check(
    `${testCase.name}: never bought, added, or cancelled anything`,
    !logs.some((l) => /added to (cart|basket)|placed (an )?order|purchase|checkout completed|cancelled the/i.test(l)),
  );

  check(`${testCase.name}: a verdict was delivered`, verdict !== null);

  if (urgency) {
    console.log(`\n  Exhibit A → ${urgency.outcome}`);
    console.log(`  ${(urgency.proof || urgency.reason || '').slice(0, 220)}`);
    if (urgency.detail?.surface) console.log(`  surface: ${urgency.detail.surface.slice(0, 90)}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

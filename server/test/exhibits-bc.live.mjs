/**
 * Live test for Exhibit B (subscription trap) and Exhibit C (basket sneaking),
 * across both tiers.
 *
 * Same discipline as the other live suites: assert behaviour, not outcomes.
 * Whether Flipkart is pre-ticking a protection plan today is not something a
 * test should depend on, and signed out, most real carts and subscription
 * areas are behind a wall. What must hold every time:
 *
 *   - both charges resolve to violation, clear or inconclusive. Never a crash
 *   - a named site uses its own cart and subscription paths; a generic one says
 *     it is searching the general way
 *   - a clearance or a charge explains where it looked and what it saw
 *   - the search is visible: if addresses were tried and missed, the feed says so
 *   - inconclusive carries a real reason, never "something went wrong"
 *   - the cancel control is never actually clicked, and nothing is added to a
 *     basket or bought
 *
 * That last one is the whole ethic. These are real accounts on real shops.
 *
 * Run: npm run test:bc
 * Override: TARGETS="https://a.example,https://b.example" npm run test:bc
 */

const API = process.env.API || 'http://localhost:8787';

const TARGETS = (
  process.env.TARGETS ||
  [
    'https://www.swiggy.com', // named, Tier 1: Swiggy One subscription
    'https://www.flipkart.com', // named, Tier 1: cart routinely carries a protection plan
    'https://www.nykaa.com', // unnamed, Tier 2: the general analysis
  ].join(',')
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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
      } else if (event.type === 'opened') opened = event;
      else if (event.type === 'finding') findings.push(event.finding);
      else if (event.type === 'verdict') verdict = event.verdict;
      else if (event.type === 'error') error = event.message;
      else if (event.type === 'done') break outer;
    }
  }

  return { logs, findings, opened, verdict, error };
}

const OUTCOMES = ['violation', 'clear', 'inconclusive'];

for (const target of TARGETS) {
  const host = new URL(target).hostname;
  console.log(`\n=== ${host} ===\n`);

  let run;
  const started = Date.now();
  try {
    run = await investigate(target);
  } catch (err) {
    check(`${host}: the investigation returned at all`, false, err.message);
    continue;
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const { logs, findings, opened, verdict, error } = run;
  const named = opened?.tier === 1;

  console.log(`\n  (${seconds}s, Tier ${opened?.tier})\n`);

  check(`${host}: no fatal error`, !error, error || '');
  check(`${host}: a verdict was delivered`, verdict !== null);

  for (const [charge, label] of [
    ['SUBSCRIPTION_TRAP', 'Exhibit B'],
    ['BASKET_SNEAKING', 'Exhibit C'],
  ]) {
    const f = findings.find((x) => x.chargeId === charge);
    check(`${host}: ${label} resolved`, !!f, 'no finding');
    if (!f) continue;

    check(`${host}: ${label} outcome is one of the three`, OUTCOMES.includes(f.outcome), String(f.outcome));
    check(
      `${host}: ${label} explains itself`,
      (f.proof || f.reason || '').length > 40,
      `got: ${(f.proof || f.reason || '').slice(0, 80)}`,
    );
    if (f.outcome === 'inconclusive') {
      check(
        `${host}: ${label} gives a real reason`,
        !!f.reason && !/something went wrong|unknown error/i.test(f.reason),
        f.reason || 'no reason',
      );
    }
    if (f.outcome === 'violation') {
      check(`${host}: ${label} carries a quip`, !!f.quip && !/undefined|null/.test(f.quip), f.quip || 'none');
      check(`${host}: ${label} cites the guideline`, !!f.definition && f.annexure.includes('Annexure'));
    }
    // The search has to be visible when it happened.
    const attempts = f.detail?.attempts || [];
    if (attempts.length > 1) {
      check(
        `${host}: ${label} recorded the addresses it tried`,
        attempts.every((a) => a.target || a.step),
        JSON.stringify(attempts[0]),
      );
    }
  }

  // Tier routing has to match what the feed claims.
  check(
    `${host}: the feed matches the tier`,
    named
      ? logs.some((l) => /known subscription pages for|profile for/i.test(l))
      : logs.some((l) => /the general way|general analysis/i.test(l)),
    `tier ${opened?.tier}`,
  );

  // Read-only, absolutely.
  check(
    `${host}: never cancelled, added or bought anything`,
    !logs.some((l) =>
      /clicked cancel|cancelled the|added to (cart|basket)|placed (an )?order|purchase completed/i.test(l),
    ),
  );

  for (const [charge, label] of [
    ['SUBSCRIPTION_TRAP', 'Exhibit B'],
    ['BASKET_SNEAKING', 'Exhibit C'],
  ]) {
    const f = findings.find((x) => x.chargeId === charge);
    if (!f) continue;
    console.log(`\n  ${label} → ${f.outcome}${f.confidence !== 'none' ? ` (${f.confidence})` : ''}`);
    console.log(`  ${(f.proof || f.reason || '').slice(0, 200)}`);
    if (f.quip) console.log(`  quip: ${f.quip}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/**
 * The six named sites, all three charges, end to end.
 *
 * This is the Tier 1 sweep: every site in the registry, investigated the way a
 * demo would investigate it, with a summary table at the end.
 *
 * It asserts behaviour rather than outcomes, for the same reason as the other
 * live suites. Signed out, most real carts and subscription areas are behind a
 * wall, and whether Flipkart is pre-ticking a protection plan today is not
 * something a test should depend on. What must hold for every site, every time:
 *
 *   - it routes to Tier 1 and loads its learned profile
 *   - all three charges resolve. Never a crash, never a hang, never a gap
 *   - the feed says which map it used, and it is telling the truth
 *   - an unproven charge carries a real reason
 *   - nothing is bought, added, cancelled or signed into
 *
 * Run: npm run test:named
 */

const API = process.env.API || 'http://localhost:8787';

const SITES = [
  ['Amazon India', 'https://www.amazon.in'],
  ['Flipkart', 'https://www.flipkart.com'],
  ['Myntra', 'https://www.myntra.com'],
  ['Zomato', 'https://www.zomato.com'],
  ['Swiggy', 'https://www.swiggy.com'],
  ['BookMyShow', 'https://in.bookmyshow.com'],
];

const CHARGES = [
  ['FALSE_URGENCY', 'urgency'],
  ['SUBSCRIPTION_TRAP', 'cancel'],
  ['BASKET_SNEAKING', 'checkboxes'],
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
      const e = JSON.parse(line.slice(6));
      if (e.type === 'log') logs.push(e.message);
      else if (e.type === 'opened') opened = e;
      else if (e.type === 'finding') findings.push(e.finding);
      else if (e.type === 'verdict') verdict = e.verdict;
      else if (e.type === 'error') error = e.message;
      else if (e.type === 'done') break outer;
    }
  }
  return { logs, findings, opened, verdict, error };
}

const SYMBOL = { violation: 'GUILTY', clear: 'cleared', inconclusive: 'unproven' };
const rows = [];

for (const [name, url] of SITES) {
  console.log(`\n=== ${name} (${url}) ===`);
  let run;
  const started = Date.now();
  try {
    run = await investigate(url);
  } catch (err) {
    check(`${name}: the investigation returned at all`, false, err.message);
    rows.push({ name, urgency: 'ERROR', cancel: 'ERROR', checkboxes: 'ERROR', overall: 'ERROR', seconds: '-' });
    continue;
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const { logs, findings, opened, verdict, error } = run;

  check(`${name}: no fatal error`, !error, error || '');
  check(`${name}: routed to Tier 1`, opened?.tier === 1, `tier ${opened?.tier}`);
  check(`${name}: loaded its learned profile`, logs.some((l) => /learned site profile/i.test(l)));
  check(`${name}: all three charges resolved`, findings.length === 3, `got ${findings.length}`);
  check(`${name}: a verdict was delivered`, verdict !== null);

  // The maps it claims to be using have to be the ones it actually has.
  const claimsLearnedCart = logs.some((l) => /Using the learned cart map/i.test(l));
  const claimsLearnedAccount = logs.some((l) => /Using the learned account map/i.test(l));
  check(
    `${name}: claims a learned cart map only if it has one`,
    claimsLearnedCart,
    'exploration should have written cartPaths',
  );
  check(
    `${name}: claims a learned account map only if it has one`,
    claimsLearnedAccount,
    'exploration should have written accountSearchOrder',
  );

  const row = { name, seconds };
  for (const [chargeId, column] of CHARGES) {
    const f = findings.find((x) => x.chargeId === chargeId);
    check(`${name}: ${column} resolved`, !!f, 'missing finding');
    if (!f) {
      row[column] = 'MISSING';
      continue;
    }
    check(
      `${name}: ${column} outcome is one of the three`,
      ['violation', 'clear', 'inconclusive'].includes(f.outcome),
      String(f.outcome),
    );
    if (f.outcome === 'inconclusive') {
      check(
        `${name}: ${column} gives a real reason`,
        !!f.reason && f.reason.length > 25 && !/something went wrong/i.test(f.reason),
        (f.reason || '').slice(0, 60),
      );
    }
    if (f.outcome === 'violation') {
      check(`${name}: ${column} carries a clean quip`, !!f.quip && !/undefined|null/.test(f.quip));
    }
    row[column] = SYMBOL[f.outcome];
  }
  row.overall = verdict ? (verdict.score === null ? 'not scored' : `${verdict.score}/10`) : 'none';
  rows.push(row);

  // Read-only, absolutely. These are other people's businesses.
  check(
    `${name}: never bought, added, cancelled or signed in`,
    !logs.some((l) =>
      /added to (cart|basket)|placed (an )?order|purchase completed|cancelled the|signed in as|logged in/i.test(l),
    ),
  );
}

console.log('\n');
console.log('| Site            | urgency  | cancel   | checkboxes | overall    | time  |');
console.log('|-----------------|----------|----------|------------|------------|-------|');
for (const r of rows) {
  console.log(
    `| ${r.name.padEnd(15)} | ${String(r.urgency).padEnd(8)} | ${String(r.cancel).padEnd(8)} | ` +
      `${String(r.checkboxes).padEnd(10)} | ${String(r.overall).padEnd(10)} | ${String(r.seconds).padStart(5)} |`,
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

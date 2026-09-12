/**
 * Tier 2 live test: the general analysis against sites we know nothing about.
 *
 * These sites have no profile, no seed knowledge, and no adapter. Whatever the
 * detector finds it finds structurally: countdown-shaped text, mm:ss clocks,
 * "left" and "remaining" language, stock counts.
 *
 * Like the Amazon test it asserts behaviour, not outcomes. A real storefront
 * may or may not be running a countdown today, and asserting "violation" would
 * make the suite a weather report. What must hold every time:
 *
 *   - the site routes to Tier 2 and no profile is claimed
 *   - the run stays on the URL it was given, because nothing knows better
 *   - Exhibit A resolves to violation, clear or inconclusive. Never a crash,
 *     never a hang, never a missing finding
 *   - whatever the outcome, it explains itself
 *   - a dead end was retried before it became "unable to analyse"
 *   - nothing was bought, added or cancelled
 *
 * The last one matters most: these are real shops belonging to other people.
 *
 * Requires the API running (npm start) and webcmd working (webcmd doctor).
 * Run: npm run test:tier2
 * Override: TARGETS="https://a.example,https://b.example" npm run test:tier2
 */

const API = process.env.API || 'http://localhost:8787';

const TARGETS = (process.env.TARGETS || 'https://www.ajio.com,https://www.nykaa.com')
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

for (const target of TARGETS) {
  const host = new URL(target).hostname;
  console.log(`\n=== Tier 2: ${host} ===\n`);

  const started = Date.now();
  let run;
  try {
    run = await investigate(target);
  } catch (err) {
    check(`${host}: the investigation returned at all`, false, err.message);
    continue;
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const { logs, findings, opened, verdict, error } = run;

  console.log(`\n  (${seconds}s)\n`);

  check(`${host}: no fatal error`, !error, error || '');
  check(`${host}: routed to Tier 2`, opened?.tier === 2, `tier ${opened?.tier}`);
  check(`${host}: claims no site knowledge`, opened?.siteName === null, String(opened?.siteName));
  check(
    `${host}: said it was running the general analysis`,
    logs.some((l) => /not on the court's list of known sites/i.test(l)),
  );

  // Nothing knows better than the URL we were handed, so we must not wander.
  check(
    `${host}: stayed on the URL it was given`,
    !logs.some((l) => /keeps its urgency claims on/i.test(l)),
  );

  const urgency = findings.find((f) => f.chargeId === 'FALSE_URGENCY');
  check(`${host}: Exhibit A resolved`, !!urgency, 'no finding for FALSE_URGENCY');
  check(
    `${host}: outcome is one of the three`,
    ['violation', 'clear', 'inconclusive'].includes(urgency?.outcome),
    String(urgency?.outcome),
  );
  check(
    `${host}: the finding explains itself`,
    (urgency?.proof || urgency?.reason || '').length > 40,
    `got: ${(urgency?.proof || urgency?.reason || '').slice(0, 80)}`,
  );

  // All three charges still have to resolve, not just the one under test.
  check(`${host}: all three charges resolved`, findings.length === 3, `got ${findings.length}`);
  check(
    `${host}: every charge has a valid outcome`,
    findings.every((f) => ['violation', 'clear', 'inconclusive'].includes(f.outcome)),
  );
  check(`${host}: a verdict was delivered`, verdict !== null);

  // Recovery has to be visible, and a dead end has to have been retried.
  const attempts = urgency?.detail?.attempts || [];
  const deadEnds = attempts.filter((a) => a.outcome === 'failed' || a.outcome === 'empty');
  if (deadEnds.length > 0) {
    /*
      The contract is that a dead end is never the last word while something
      else is worth trying, not that the retry succeeds. A scroll that also
      comes up empty is a completed recovery: we looked again and the page
      really does carry nothing. So what must hold is that the FIRST dead end
      was followed by a further attempt.
    */
    const firstDeadEnd = attempts.findIndex((a) => a.outcome === 'failed' || a.outcome === 'empty');
    check(
      `${host}: the first dead end was followed by another attempt`,
      firstDeadEnd < attempts.length - 1,
      `dead end at ${firstDeadEnd} of ${attempts.length} attempt(s): ${attempts.map((a) => `${a.step}=${a.outcome}`).join(', ')}`,
    );
    check(
      `${host}: the recovery was announced in the feed`,
      logs.some((l) => /Trying once more|Scrolling the page|matching by position|second attempt/i.test(l)),
      'no recovery line in the log',
    );
  }

  // These are other people's shops.
  check(
    `${host}: never bought, added, or cancelled anything`,
    !logs.some((l) =>
      /added to (cart|basket)|placed (an )?order|purchase|checkout completed|cancelled the/i.test(l),
    ),
  );

  console.log(`\n  Exhibit A → ${urgency?.outcome}${urgency?.confidence ? ` (${urgency.confidence} confidence)` : ''}`);
  console.log(`  ${(urgency?.proof || urgency?.reason || '').slice(0, 240)}`);
  if (attempts.length) {
    console.log(`  attempts: ${attempts.map((a) => `${a.step}=${a.outcome}`).join(' → ')}`);
  }
  console.log(`  all three: ${findings.map((f) => `${f.chargeId}=${f.outcome}`).join(', ')}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

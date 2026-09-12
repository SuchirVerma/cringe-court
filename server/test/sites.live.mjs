/**
 * Reliability sweep across real sites.
 *
 * The pass condition is not "finds violations". It is: never crashes, never
 * hangs, and all three charges resolve to one of the three states every time.
 * A site that comes back all-inconclusive with honest reasons is a PASS.
 *
 * Run: node test/sites.live.mjs [url ...]
 */

const API = process.env.API || 'http://localhost:8787';

const DEFAULT_SITES = [
  ['Amazon India', 'https://www.amazon.in/'],
  ['Myntra', 'https://www.myntra.com/'],
  ['Zomato', 'https://www.zomato.com/'],
  ['Swiggy', 'https://www.swiggy.com/'],
  ['BookMyShow', 'https://in.bookmyshow.com/'],
  ['Booking.com (unfamiliar)', 'https://www.booking.com/'],
  ['Nykaa (unfamiliar)', 'https://www.nykaa.com/'],
  ['example.com (minimal)', 'https://example.com/'],
];

const OUTCOME_MARK = { violation: 'UPHELD', clear: 'CLEARED', inconclusive: 'UNPROVEN' };

async function investigate(label, url) {
  const started = Date.now();
  const findings = [];
  let verdict = null;
  let fatal = null;
  let tier = null;

  try {
    const res = await fetch(`${API}/api/investigate?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`API ${res.status}`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    outer: for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const frames = buf.split('\n\n');
      buf = frames.pop() ?? '';
      for (const f of frames) {
        const line = f.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        const e = JSON.parse(line.slice(6));
        if (e.type === 'opened') tier = e.tier;
        else if (e.type === 'finding') findings.push(e.finding);
        else if (e.type === 'verdict') verdict = e.verdict;
        else if (e.type === 'error') fatal = e.message;
        else if (e.type === 'done') break outer;
      }
    }
  } catch (err) {
    fatal = err.message;
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const resolved = findings.length === 3 && findings.every((f) => OUTCOME_MARK[f.outcome]);
  const pass = resolved && !fatal;

  // One compact line per site, so progress is visible as it happens.
  const summary = findings
    .map((f) => `${f.exhibit.replace('Exhibit ', '')}:${OUTCOME_MARK[f.outcome] || '??'}`)
    .join(' ');

  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(26)} tier${tier ?? '?'}  ${seconds.padStart(5)}s  ${summary.padEnd(34)} ${
      verdict ? (verdict.score === null ? 'adjourned' : `${verdict.score}/10`) : 'no verdict'
    }${fatal ? `  FATAL: ${fatal}` : ''}`,
  );

  for (const f of findings) {
    if (f.outcome === 'inconclusive') console.log(`        ${f.exhibit} unproven: ${f.reason}`);
    if (f.outcome === 'violation') console.log(`        ${f.exhibit} UPHELD: ${(f.proof || '').slice(0, 150)}`);
  }

  return { label, url, pass, resolved, fatal, findings, verdict, seconds };
}

const args = process.argv.slice(2);
const sites = args.length ? args.map((u) => [u, u]) : DEFAULT_SITES;

const results = [];
for (const [label, url] of sites) {
  results.push(await investigate(label, url));
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} sites resolved cleanly`);
const broken = results.filter((r) => !r.pass);
if (broken.length) {
  console.log('Not clean:');
  for (const b of broken) console.log(`  ${b.label}: ${b.fatal || `only ${b.findings.length}/3 charges resolved`}`);
}
process.exit(broken.length ? 1 : 0);

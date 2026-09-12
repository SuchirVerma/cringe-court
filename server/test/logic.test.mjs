import { violation, clear, inconclusive, resolveAlways } from '../src/evidence.js';
import { buildVerdict } from '../src/verdict.js';
import { resolveTier } from '../src/sites.js';
import { normaliseUrl } from '../src/investigate.js';
import { pairReadings, scanWithRetry } from '../src/detectors/fake-urgency.js';
import { quipFor } from '../src/quips.js';

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } };

console.log('URL handling');
t('bare domain gets scheme', normaliseUrl('flipkart.com') === 'https://flipkart.com/');
t('garbage rejected', normaliseUrl('not a url') === null);
t('empty rejected', normaliseUrl('') === null);
t('localhost accepted', normaliseUrl('http://localhost:8080/index.html') === 'http://localhost:8080/index.html');
t('bare IP accepted', normaliseUrl('http://127.0.0.1:8080/') === 'http://127.0.0.1:8080/');
t('single-word host rejected', normaliseUrl('somehost') === null);
t('non-http scheme rejected', normaliseUrl('file:///etc/passwd') === null);

console.log('Tier routing');
t('amazon.in is tier 1', resolveTier('https://www.amazon.in/deals').tier === 1);
t('subdomain of named site is tier 1', resolveTier('https://in.bookmyshow.com/x').tier === 1);
t('random site is tier 2', resolveTier('https://example.com').tier === 2);
t('lookalike domain is NOT tier 1', resolveTier('https://notamazon.in.evil.com').tier === 2);

console.log('Evidence factories');
const v = violation('FALSE_URGENCY', { tier: 1, proof: 'p', detail: { firstReading: '02:59', secondReading: '02:59', waitedSeconds: 6 } });
t('violation has a quip', typeof v.quip === 'string' && v.quip.length > 0);
t('quip has no undefined', !v.quip.includes('undefined'));
t('violation carries remedies', v.remedies.length > 0);
t('violation cites annexure', v.annexure.includes('Annexure'));
const v2 = violation('FALSE_URGENCY', { tier: 1, proof: 'p', detail: { firstReading: '02:59', secondReading: '02:59', waitedSeconds: 6 } });
t('quip is deterministic', v.quip === v2.quip);
const vEmpty = violation('BASKET_SNEAKING', { tier: 2, proof: 'p', detail: {} });
t('quip safe with empty detail', vEmpty.quip === null || (!vEmpty.quip.includes('undefined') && !vEmpty.quip.includes('null')));

console.log('Always resolves');
const thrown = await resolveAlways('FALSE_URGENCY', 2, async () => { throw new Error('boom'); });
t('thrown error becomes inconclusive', thrown.outcome === 'inconclusive' && thrown.reason.includes('boom'));
const nothing = await resolveAlways('FALSE_URGENCY', 2, async () => undefined);
t('undefined becomes inconclusive', nothing.outcome === 'inconclusive');
const slow = await resolveAlways('FALSE_URGENCY', 2, () => new Promise(r => setTimeout(r, 5000)), { timeout: 150 });
t('overrun becomes inconclusive', slow.outcome === 'inconclusive' && slow.reason.includes('past'));

console.log('Verdict');
const guilty = buildVerdict({ url:'https://x.com', host:'x.com', tier:2, site:null, startedAt:new Date().toISOString(),
  findings: [v, clear('SUBSCRIPTION_TRAP',{tier:2,proof:'p'}), inconclusive('BASKET_SNEAKING',{tier:2,reason:'r'})] });
t('guilty on one violation', guilty.guilty === true);
t('score deducted', guilty.score === 7);
t('counts correct', guilty.counts.violations===1 && guilty.counts.cleared===1 && guilty.counts.inconclusive===1);
t('discloses inconclusive', guilty.disclosure.note.includes('1 of 3'));
const innocent = buildVerdict({ url:'https://x.com', host:'x.com', tier:2, site:null, startedAt:new Date().toISOString(),
  findings: ['FALSE_URGENCY','SUBSCRIPTION_TRAP','BASKET_SNEAKING'].map(c => clear(c,{tier:2,proof:'p'})) });
t('clean site scores 10', innocent.score === 10 && innocent.guilty === false);
t('score never below 1', buildVerdict({url:'https://x.com',host:'x',tier:2,site:null,startedAt:new Date().toISOString(),
  findings:['FALSE_URGENCY','SUBSCRIPTION_TRAP','BASKET_SNEAKING'].map(c=>violation(c,{tier:2,proof:'p',detail:{}}))}).score >= 1);

console.log('Scoring honesty');
const mostlyUnknown = buildVerdict({ url:'https://x.com', host:'x.com', tier:2, site:null, startedAt:new Date().toISOString(),
  findings: [clear('FALSE_URGENCY',{tier:2,proof:'p'}), inconclusive('SUBSCRIPTION_TRAP',{tier:2,reason:'r'}), inconclusive('BASKET_SNEAKING',{tier:2,reason:'r'})] });
t('declines to score when most charges undetermined', mostlyUnknown.ruled === false && mostlyUnknown.score === null);
t('says how many were examined', mostlyUnknown.headline.includes('1 of 3'));
const oneViolationMostlyUnknown = buildVerdict({ url:'https://x.com', host:'x.com', tier:2, site:null, startedAt:new Date().toISOString(),
  findings: [v, inconclusive('SUBSCRIPTION_TRAP',{tier:2,reason:'r'}), inconclusive('BASKET_SNEAKING',{tier:2,reason:'r'})] });
t('still rules when a violation was proven', oneViolationMostlyUnknown.ruled === true && oneViolationMostlyUnknown.score === 7);

console.log('The order');
// Every verdict above already drew a case number, so these are simply the next two.
const orderA = buildVerdict({ url:'https://x.com', host:'x.com', tier:2, site:null, startedAt:new Date().toISOString(),
  findings: [clear('FALSE_URGENCY',{tier:2,proof:'p'})] });
const orderB = buildVerdict({ url:'https://y.com', host:'y.com', tier:2, site:null, startedAt:new Date().toISOString(),
  findings: [clear('FALSE_URGENCY',{tier:2,proof:'p'})] });
t('case number is formatted', /^CC-\d{4}-\d{3}$/.test(orderA.order.caseNumber));
t('case number advances per hearing', orderA.order.caseNumber !== orderB.order.caseNumber);
t('defendant is named', orderA.order.defendant === 'x.com');
t('falls back to the url when there is no host', buildVerdict({ url:'https://z.com', host:null, tier:2, site:null,
  startedAt:new Date().toISOString(), findings: [clear('FALSE_URGENCY',{tier:2,proof:'p'})] }).order.defendant === 'https://z.com');
t('the bench is named', typeof orderA.order.bench === 'string' && orderA.order.bench.length > 0);
t('sitting date is written out', /\d{4}/.test(orderA.order.sitting) && !orderA.order.sitting.includes('Invalid'));

console.log('Pairing two readings');
const clock = (path, text, extra = {}) => ({ path, text, kind: 'clock', numbers: [], stockCount: null, ...extra });
const stock = (path, text, count) => ({ path, text, kind: 'stock', numbers: [count], stockCount: count });

// Strict: the same element, identified by its path.
const strict = pairReadings(
  [clock('body > div:nth-of-type(1) > span', '02:59')],
  [clock('body > div:nth-of-type(1) > span', '02:53')],
);
t('strict pairs by path', strict.length === 1 && strict[0].moved === true);
t('strict marks a real countdown as moved', strict[0].a === 179 && strict[0].b === 173);
t('strict is not a loose match', strict[0].loose === false);

const frozen = pairReadings([clock('p', '02:59')], [clock('p', '02:59')]);
t('a frozen clock does not read as moved', frozen.length === 1 && frozen[0].moved === false);
t('a frozen clock is flagged identical', frozen[0].identical === true);

// A path that moved is not paired strictly, which is what triggers recovery.
const moved = pairReadings([clock('body > div:nth-of-type(1)', '02:59')], [clock('body > div:nth-of-type(7)', '02:59')]);
t('strict refuses to pair an element that moved', moved.length === 0);

// Loose: same kind, same position in the list.
const loose = pairReadings(
  [clock('a', '02:59'), clock('b', '10:00')],
  [clock('x', '02:59'), clock('y', '09:54')],
  { loose: true },
);
t('loose pairs by position', loose.length === 2);
t('loose keeps the order', loose[0].before.text === '02:59' && loose[0].after.text === '02:59');
t('loose spots the frozen one', loose[0].moved === false && loose[1].moved === true);
t('loose marks itself as loose', loose.every((p) => p.loose === true));

// Loose must never pair a clock against a stock claim.
const kinds = pairReadings([clock('a', '02:59')], [stock('x', 'only 3 left', 3)], { loose: true });
t('loose never pairs across kinds', kinds.length === 0);

// Uneven counts must not throw or invent a pair.
t('loose handles more before than after', pairReadings([clock('a', '1:00'), clock('b', '2:00')], [clock('x', '0:59')], { loose: true }).length === 1);
t('loose handles an empty reading', pairReadings([clock('a', '1:00')], [], { loose: true }).length === 0);
t('strict handles an empty reading', pairReadings([clock('a', '1:00')], []).length === 0);

// Stock counts compare as numbers, and hours parse.
const stockPair = pairReadings([stock('s', 'only 5 left', 5)], [stock('s', 'only 3 left', 3)]);
t('stock counts compare', stockPair.length === 1 && stockPair[0].moved === true);
const hours = pairReadings([clock('h', '01:00:00')], [clock('h', '00:59:58')]);
t('hh:mm:ss parses', hours.length === 1 && hours[0].a === 3600 && hours[0].moved === true);

console.log('Retry and recovery');
{
  // A read that works first time must not be retried, and must not be narrated.
  const calls = [];
  const lines = [];
  const attempts = [];
  const ok = await scanWithRetry('s', { navigateTo: 'x' }, {
    log: (m) => lines.push(m),
    what: 'Reading the page',
    attempts,
    run: async (_s, _p, input) => { calls.push(input); return { ok: true, data: { candidates: [] } }; },
  });
  t('a working read is not retried', calls.length === 1 && ok.ok === true);
  t('a working read says nothing about retries', lines.length === 0);
  t('a working read records no dead end', attempts.length === 0);
}
{
  // Fails once, then works: one retry, with a longer settle, announced.
  const calls = [];
  const lines = [];
  const attempts = [];
  const res = await scanWithRetry('s', { navigateTo: 'x' }, {
    log: (m) => lines.push(m),
    what: 'Reading the page',
    attempts,
    run: async (_s, _p, input) => {
      calls.push(input);
      return calls.length === 1
        ? { ok: false, reason: 'Page analysis timed out after 40 seconds' }
        : { ok: true, data: { candidates: [] } };
    },
  });
  t('a failed read is retried once', calls.length === 2);
  t('the retry recovers', res.ok === true);
  t('the retry waits longer than the first try', calls[1].settleMs > 0 && !('settleMs' in calls[0]));
  t('the retry keeps the original navigation', calls[1].navigateTo === 'x');
  t('the failure is announced', lines.some((l) => /Trying once more/i.test(l)));
  t('the recovery is announced', lines.some((l) => /second attempt worked/i.test(l)));
  t('the attempt log records the failure and the recovery',
    attempts.length === 2 && attempts[0].outcome === 'failed' && attempts[1].outcome === 'recovered');
  t('the failure reason is kept', attempts[0].reason.includes('timed out'));
}
{
  // Fails twice: gives up, does not loop, and says so.
  const calls = [];
  const lines = [];
  const attempts = [];
  const res = await scanWithRetry('s', {}, {
    log: (m) => lines.push(m),
    what: 'Reading the page a second time',
    attempts,
    run: async () => { calls.push(1); return { ok: false, reason: 'No browser session' }; },
  });
  t('two failures stop, never loop', calls.length === 2);
  t('the caller is told it failed', res.ok === false && res.reason === 'No browser session');
  t('both failures are recorded', attempts.length === 2 && attempts.every((a) => a.outcome === 'failed'));
  t('the second failure is announced', lines.some((l) => /second attempt failed too/i.test(l)));
}

console.log('Quips land on the evidence');
{
  const deep = (steps) => quipFor('SUBSCRIPTION_TRAP', { steps, labelFound: 'Manage membership', vagueOnly: true });
  t('a five-step cancel gets the wine tasting line', /wine tasting/.test(deep(5)));
  t('a seven-step cancel gets it too', /wine tasting/.test(deep(7)));
  t('a three-step cancel does not', !/wine tasting/.test(deep(3)));
  t('the wine tasting line quotes the step count', deep(6).startsWith('6 steps'));
  t('an exhausted search keeps its own line', /Simply absent/.test(quipFor('SUBSCRIPTION_TRAP', { exhausted: true, steps: 9 })));

  // The house rule: never render a hole at the user.
  const holes = [
    quipFor('BASKET_SNEAKING', { chargeWord: 'insurance' }),
    quipFor('BASKET_SNEAKING', {}),
    quipFor('SUBSCRIPTION_TRAP', { steps: 5 }),
    quipFor('SUBSCRIPTION_TRAP', {}),
    quipFor('FALSE_URGENCY', {}),
  ];
  t('no quip renders undefined or null', holes.every((q) => q === null || (!q.includes('undefined') && !q.includes('null'))));
  t('quips stay deterministic', quipFor('BASKET_SNEAKING', { chargeWord: 'tip', price: '₹9' }) === quipFor('BASKET_SNEAKING', { chargeWord: 'tip', price: '₹9' }));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

import { violation, clear, inconclusive, resolveAlways } from '../src/evidence.js';
import { buildVerdict } from '../src/verdict.js';
import { resolveTier } from '../src/sites.js';
import { normaliseUrl } from '../src/investigate.js';

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

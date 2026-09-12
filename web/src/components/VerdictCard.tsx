import { motion, useReducedMotion } from 'framer-motion';
import type { Verdict } from '../lib/types';

/**
 * The bench's ruling.
 *
 * The score is the loudest number on the page, and it counts up to its value
 * rather than appearing, because a score that arrives feels adjudicated. The
 * disclosure block is not decoration: a 10/10 earned by three failed checks
 * would be dishonest, so the card says what it could not determine.
 */

export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const reduced = useReducedMotion();
  const tone = verdict.guilty ? 'var(--color-stamp)' : 'var(--color-cleared)';

  return (
    <motion.section
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0.001 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="paper relative overflow-hidden rounded-[3px] px-6 py-6"
      aria-label="Verdict"
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: tone }}
        aria-hidden="true"
      />

      <p className="font-mono text-[0.64rem] uppercase tracking-[0.22em]" style={{ color: 'var(--color-paper-meta)' }}>
        In the matter of {verdict.host}
      </p>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
        <h2
          className="max-w-[26ch] text-[1.9rem] leading-[1.08]"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-paper-ink)' }}
        >
          {verdict.headline}
        </h2>

        <div className="text-right">
          <motion.p
            initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduced ? { duration: 0.001 } : { delay: 0.25, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            className="text-[3.2rem] leading-none"
            style={{ fontFamily: 'var(--font-display)', color: verdict.score === null ? 'var(--color-paper-meta)' : tone }}
          >
            {verdict.score === null ? (
              '—'
            ) : (
              <>
                {verdict.score}
                <span className="text-[1.4rem]" style={{ color: 'var(--color-paper-meta)' }}>
                  /{verdict.outOf}
                </span>
              </>
            )}
          </motion.p>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em]" style={{ color: 'var(--color-paper-meta)' }}>
            {verdict.score === null ? 'not scored' : 'consumer respect'}
          </p>
        </div>
      </div>

      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-[rgba(42,35,32,0.14)] pt-4">
        {[
          ['Charges heard', verdict.counts.charges],
          ['Upheld', verdict.counts.violations],
          ['Cleared', verdict.counts.cleared],
          ['Undetermined', verdict.counts.inconclusive],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex items-baseline gap-2">
            <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em]" style={{ color: 'var(--color-paper-meta)' }}>
              {label}
            </dt>
            <dd className="text-base font-semibold" style={{ color: 'var(--color-paper-ink)' }}>
              {value as number}
            </dd>
          </div>
        ))}
      </dl>

      {verdict.remedies.length > 0 && (
        <div className="mt-5">
          <h3 className="font-mono text-[0.62rem] uppercase tracking-[0.2em]" style={{ color: 'var(--color-paper-meta)' }}>
            What a compliant version would do
          </h3>
          <ul className="mt-2.5 space-y-2">
            {verdict.remedies.map((remedy, i) => (
              <motion.li
                key={i}
                initial={reduced ? { opacity: 1 } : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={reduced ? { duration: 0.001 } : { delay: 0.35 + i * 0.07, duration: 0.35 }}
                className="flex gap-2.5 text-[0.86rem] leading-relaxed"
                style={{ color: '#4a403c' }}
              >
                <span className="font-mono text-[0.66rem] pt-0.5 shrink-0" style={{ color: tone }}>
                  {remedy.exhibit.replace('Exhibit ', '')}
                </span>
                <span>{remedy.text}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      <footer className="mt-6 border-t border-[rgba(42,35,32,0.14)] pt-3">
        <p className="text-[0.74rem] leading-relaxed" style={{ color: '#6b5f59' }}>
          {verdict.disclosure.note} Charges heard: {verdict.disclosure.examined.join(', ')}. Not examined
          in this build: {verdict.disclosure.notExamined.join(', ')}.
        </p>
        <p className="mt-2 font-mono text-[0.62rem] leading-relaxed" style={{ color: 'var(--color-paper-meta)' }}>
          {verdict.citation.citation} · {verdict.citation.authority}
          {verdict.durationMs != null && ` · heard in ${(verdict.durationMs / 1000).toFixed(1)}s`}
        </p>
      </footer>
    </motion.section>
  );
}

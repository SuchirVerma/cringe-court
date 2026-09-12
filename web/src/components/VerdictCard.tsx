import { useRef } from 'react';
import { motion, useReducedMotion, type MotionValue } from 'framer-motion';
import type { Verdict } from '../lib/types';
import { clause, unroll } from '../animations/framerVariants';
import { useOrderScroll } from '../animations/scrollTriggers';
import { Stamp } from './Stamp';

/**
 * The order of the court.
 *
 * It unrolls onto the desk when it is handed down, its masthead stays with you
 * as you read down the clauses, and the rule down its margin fills as you go.
 *
 * The reveal is tied to the order arriving, not to scroll position. A
 * scroll-driven reveal can leave a visitor looking at a half-drawn document if
 * they never scroll, which on a live demo reads as a broken page. Scroll only
 * draws the margin rule, which is decoration and safe to leave unfinished.
 *
 * The score is the loudest number here. The disclosure block under it is not
 * decoration either: a 10/10 earned by three failed checks would be a lie, so
 * the order says what it could not determine.
 */

export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { ruleScale, sealDrift } = useOrderScroll(ref);

  const tone = verdict.guilty ? 'var(--color-stamp)' : 'var(--color-cleared)';

  /*
    The order block is filled in by the server, and the rest of this card does
    not depend on it. So it is read defensively rather than destructured: a
    payload from an older server, or one truncated in transit, must degrade to a
    heading without a case number, never to a blank page.

    This is the same promise the detectors make. A charge that cannot be
    examined resolves to "inconclusive" instead of throwing, and a verdict that
    arrives short of a field renders what it does have. The rule holds on both
    sides of the wire.
  */
  const order = {
    caseNumber: verdict.order?.caseNumber ?? null,
    defendant: verdict.order?.defendant ?? verdict.host ?? verdict.url,
    bench: verdict.order?.bench ?? null,
    sitting: verdict.order?.sitting ?? null,
  };

  return (
    <motion.section
      ref={ref}
      variants={unroll(reduced)}
      initial="hidden"
      animate="shown"
      // Unrolled from the top edge, the way paper comes off a roll.
      style={{ transformOrigin: 'top center' }}
      /*
        No overflow-hidden here, deliberately. An overflow container becomes the
        scroll box for any `position: sticky` inside it, and since this card
        never scrolls, the masthead would simply never stick. Nothing in the
        card needs clipping: the seal and the margin rule are both laid out
        inside the padding box.
      */
      className="paper relative rounded-[3px] py-6 pl-7 pr-6"
      aria-label="Order of the court"
    >
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: tone }} aria-hidden="true" />

      {/* The margin rule, filling as the order is read. */}
      <motion.div
        className="absolute bottom-0 left-0 top-0 w-[5px] origin-top"
        style={{ background: `linear-gradient(180deg, ${tone}, var(--color-stamp-muted))`, scaleY: ruleScale }}
        aria-hidden="true"
      />

      <Seal drift={sealDrift} tone={tone} />

      <motion.header variants={clause(reduced)} className="order-masthead -mx-1 px-1 pb-3 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p
            className="font-mono text-[0.64rem] uppercase tracking-[0.22em]"
            style={{ color: 'var(--color-paper-meta)' }}
          >
            In the matter of {order.defendant}
          </p>
          {order.caseNumber && (
            <p
              className="font-mono text-[0.64rem] uppercase tracking-[0.18em]"
              style={{ color: 'var(--color-paper-meta)' }}
            >
              Case {order.caseNumber}
            </p>
          )}
        </div>
      </motion.header>

      <motion.div variants={clause(reduced)} className="mt-3 flex flex-wrap items-end justify-between gap-5">
        <h2
          className="max-w-[26ch] text-[1.9rem] leading-[1.08]"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-paper-ink)' }}
        >
          {verdict.headline}
        </h2>

        <div className="flex flex-col items-end gap-3 text-right">
          {/*
            The ruling itself, stamped. It is the largest mark on the page and
            it lands last, after the paper has finished unrolling, because a
            stamp goes onto a finished document and not a moving one.
          */}
          <Stamp
            size="lg"
            outcome={verdict.guilty ? 'violation' : verdict.ruled ? 'clear' : 'inconclusive'}
            label={verdict.guilty ? 'GUILTY' : verdict.ruled ? 'NOT GUILTY' : 'ADJOURNED'}
            delay={reduced ? 0 : 0.95}
          />
          <motion.p
            initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduced ? { duration: 0.001 } : { delay: 0.55, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            className="text-[3.2rem] leading-none"
            style={{
              fontFamily: 'var(--font-display)',
              color: verdict.score === null ? 'var(--color-paper-meta)' : tone,
            }}
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
          <p
            className="font-mono text-[0.6rem] uppercase tracking-[0.18em]"
            style={{ color: 'var(--color-paper-meta)' }}
          >
            {verdict.score === null ? 'not scored' : 'consumer respect'}
          </p>
        </div>
      </motion.div>

      <motion.dl
        variants={clause(reduced)}
        className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-[rgba(42,35,32,0.14)] pt-4"
      >
        {[
          ['Charges heard', verdict.counts.charges],
          ['Upheld', verdict.counts.violations],
          ['Cleared', verdict.counts.cleared],
          ['Undetermined', verdict.counts.inconclusive],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex items-baseline gap-2">
            <dt
              className="font-mono text-[0.6rem] uppercase tracking-[0.16em]"
              style={{ color: 'var(--color-paper-meta)' }}
            >
              {label}
            </dt>
            <dd className="text-base font-semibold" style={{ color: 'var(--color-paper-ink)' }}>
              {value as number}
            </dd>
          </div>
        ))}
      </motion.dl>

      {verdict.remedies.length > 0 && (
        <motion.div variants={clause(reduced)} className="mt-5">
          <h3
            className="font-mono text-[0.62rem] uppercase tracking-[0.2em]"
            style={{ color: 'var(--color-paper-meta)' }}
          >
            It is ordered that
          </h3>
          <ul className="mt-2.5 space-y-2">
            {verdict.remedies.map((remedy, i) => (
              <motion.li
                key={i}
                initial={reduced ? { opacity: 1 } : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={reduced ? { duration: 0.001 } : { delay: 0.7 + i * 0.07, duration: 0.35 }}
                className="flex gap-2.5 text-[0.86rem] leading-relaxed"
                style={{ color: '#4a403c' }}
              >
                <span className="shrink-0 pt-0.5 font-mono text-[0.66rem]" style={{ color: tone }}>
                  {remedy.exhibit.replace('Exhibit ', '')}
                </span>
                <span>{remedy.text}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.footer variants={clause(reduced)} className="mt-6 border-t border-[rgba(42,35,32,0.14)] pt-3">
        {(order.bench || order.sitting) && (
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
            {order.bench && (
              <p className="text-[0.76rem]" style={{ color: '#5d524d' }}>
                {order.bench}
              </p>
            )}
            {order.sitting && (
              <p
                className="font-mono text-[0.62rem] uppercase tracking-[0.16em]"
                style={{ color: 'var(--color-paper-meta)' }}
              >
                {order.sitting}
              </p>
            )}
          </div>
        )}

        <p className="text-[0.74rem] leading-relaxed" style={{ color: '#6b5f59' }}>
          {verdict.disclosure.note} Charges heard: {verdict.disclosure.examined.join(', ')}. Not examined
          in this build: {verdict.disclosure.notExamined.join(', ')}.
        </p>
        <p className="mt-2 font-mono text-[0.62rem] leading-relaxed" style={{ color: 'var(--color-paper-meta)' }}>
          {verdict.citation.citation} · {verdict.citation.authority}
          {verdict.durationMs != null && ` · heard in ${(verdict.durationMs / 1000).toFixed(1)}s`}
        </p>
      </motion.footer>
    </motion.section>
  );
}

/**
 * The court's seal, drawn rather than generated: an SVG stays crisp at any size,
 * takes the order's own colour, and weighs nothing. It drifts against the
 * scroll so the paper has some depth under it.
 */
function Seal({ drift, tone }: { drift: MotionValue<number>; tone: string }) {
  return (
    <motion.svg
      className="pointer-events-none absolute right-5 top-1/2 h-[132px] w-[132px] -translate-y-1/2"
      style={{ y: drift, opacity: 0.09 }}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="55" stroke={tone} strokeWidth="2" />
      <circle cx="60" cy="60" r="46" stroke={tone} strokeWidth="1" strokeDasharray="3 4" />
      {/* Scales of justice: a beam, two pans, a stand. */}
      <path
        d="M60 36v46M38 46h44M38 46l-9 16h18zM82 46l-9 16h18zM48 88h24"
        stroke={tone}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

import { motion, useReducedMotion } from 'framer-motion';
import type { Finding } from '../lib/types';
import { Stamp } from './Stamp';
import { exhibitDrop, exhibitFlip } from '../animations/framerVariants';

/**
 * One exhibit, laid onto the desk.
 *
 * A violation gets the full paper card: the quip, the observational proof, the
 * guideline it engages. A cleared or inconclusive charge gets a quieter strip,
 * because they must always be visible (all three charges resolve on screen) but
 * must not compete with an actual finding.
 */

/** The examined URL, trimmed to something readable in a caption. */
function surfaceLabel(detail: Record<string, unknown> | undefined): string | null {
  const raw = detail?.surface;
  if (typeof raw !== 'string' || !raw) return null;
  const bare = raw.replace(/^https?:\/\//, '');
  return bare.length > 72 ? `${bare.slice(0, 72)}…` : bare;
}

export function EvidenceCard({ finding, index }: { finding: Finding; index: number }) {
  const reduced = useReducedMotion();
  const isViolation = finding.outcome === 'violation';
  const surface = surfaceLabel(finding.detail);

  return (
    <motion.article
      // A charge is turned face-up on the desk; a cleared or unproven strip is
      // simply laid down. The flip is reserved for the finding that earns it.
      variants={isViolation ? exhibitFlip(reduced, index) : exhibitDrop(reduced, index)}
      initial="hidden"
      animate="shown"
      className={
        isViolation
          ? 'paper taped relative overflow-hidden rounded-[3px] pl-6 pr-5 py-5'
          : 'relative overflow-hidden rounded-[3px] border border-[var(--color-panel-edge)] bg-[var(--color-panel)] px-5 py-4'
      }
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="font-mono text-[0.68rem] uppercase tracking-[0.18em]"
            style={{ color: isViolation ? 'var(--color-paper-meta)' : 'var(--color-ink-500)' }}
          >
            {finding.exhibit} · {finding.annexure}
          </p>
          <h3
            className="mt-1 text-xl leading-tight"
            style={{
              fontFamily: 'var(--font-display)',
              color: isViolation ? 'var(--color-paper-ink)' : 'var(--color-ink-100)',
            }}
          >
            {finding.charge}
          </h3>
        </div>
        <div className="shrink-0 pt-1">
          <Stamp outcome={finding.outcome} delay={reduced ? 0 : 0.3} />
        </div>
      </header>

      {isViolation && finding.quip && (
        <p
          className="mt-4 text-[1.02rem] leading-relaxed"
          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: '#3d3330' }}
        >
          {finding.quip}
        </p>
      )}

      {finding.proof && (
        <div className="mt-4">
          <p
            className="font-mono text-[0.62rem] uppercase tracking-[0.2em]"
            style={{ color: isViolation ? 'var(--color-paper-meta)' : 'var(--color-ink-600)' }}
          >
            What was observed
          </p>
          <p
            className="mt-1.5 text-[0.86rem] leading-relaxed"
            style={{ color: isViolation ? '#4a403c' : 'var(--color-ink-300)' }}
          >
            {finding.proof}
          </p>
        </div>
      )}

      {finding.outcome === 'inconclusive' && finding.reason && (
        <p className="mt-3 text-[0.86rem] leading-relaxed" style={{ color: 'var(--color-ink-300)' }}>
          {finding.reason}
        </p>
      )}

      {/*
        Where the court actually looked. On a Tier 1 site the run often leaves
        the address it was given, because the claims live somewhere else on that
        site, and a reader who is not told that will reasonably assume the
        verdict is about the page they pasted.
      */}
      {surface && (
        <p
          className="mt-3 font-mono text-[0.64rem] leading-relaxed"
          style={{ color: isViolation ? 'var(--color-paper-meta)' : 'var(--color-ink-600)' }}
        >
          Examined {surface}
        </p>
      )}

      {isViolation && (
        <footer className="mt-5 border-t border-[rgba(42,35,32,0.14)] pt-3">
          <p className="text-[0.78rem] leading-relaxed" style={{ color: '#5d524d' }}>
            <span className="font-semibold">The guideline:</span> {finding.definition}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="font-mono text-[0.6rem] uppercase tracking-[0.16em] px-2 py-0.5 rounded-sm"
              style={{ background: 'rgba(123, 90, 166, 0.14)', color: '#5c4380' }}
            >
              Tier {finding.tier} {finding.tier === 1 ? 'learned profile' : 'general analysis'}
            </span>
            <span
              className="font-mono text-[0.6rem] uppercase tracking-[0.16em]"
              style={{ color: 'var(--color-paper-meta)' }}
            >
              {finding.confidence} confidence
            </span>
          </div>
        </footer>
      )}
    </motion.article>
  );
}

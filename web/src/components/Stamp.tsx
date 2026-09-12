import { motion, useReducedMotion } from 'framer-motion';
import type { Outcome } from '../lib/types';

/**
 * The signature element: a rubber stamp that lands on the exhibit.
 *
 * It is the one place the boldness budget is spent. Everything else on the page
 * stays quiet so this reads. Remove it and the page is meaningfully duller,
 * which is the test of whether a signature is actually a signature.
 *
 * The impact is scale and rotation only (both compositor-friendly), with an ink
 * bleed ring that expands once and dies. Reduced motion gets the landed state
 * with no travel.
 */

const FACE: Record<Outcome, { label: string; tone: string; ring: string }> = {
  violation: { label: 'GUILTY', tone: 'var(--color-stamp)', ring: 'rgba(194, 64, 44, 0.32)' },
  clear: { label: 'CLEARED', tone: 'var(--color-cleared)', ring: 'rgba(127, 154, 114, 0.3)' },
  inconclusive: { label: 'UNPROVEN', tone: 'var(--color-unknown)', ring: 'rgba(155, 140, 106, 0.3)' },
};

export function Stamp({ outcome, delay = 0 }: { outcome: Outcome; delay?: number }) {
  const reduced = useReducedMotion();
  const face = FACE[outcome];

  return (
    <div className="pointer-events-none relative select-none" aria-hidden="true">
      {/* Ink bleed: one expansion, then gone. */}
      {!reduced && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: face.ring }}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [0.3, 1.9, 2.3], opacity: [0, 0.55, 0] }}
          transition={{ delay: delay + 0.18, duration: 0.75, ease: 'easeOut' }}
        />
      )}

      <motion.div
        className="relative grid place-items-center rounded-sm border-[3px] px-3 py-1"
        style={{
          borderColor: face.tone,
          color: face.tone,
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.18em',
          // A stamp is never perfectly opaque; the ink is uneven.
          opacity: 0.92,
        }}
        initial={reduced ? { opacity: 0.92, scale: 1, rotate: -8 } : { opacity: 0, scale: 2.6, rotate: -22 }}
        animate={{ opacity: 0.92, scale: 1, rotate: -8 }}
        transition={
          reduced
            ? { duration: 0 }
            : { delay, duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }
        }
      >
        <span className="text-[0.68rem] font-semibold">{face.label}</span>
      </motion.div>
    </div>
  );
}

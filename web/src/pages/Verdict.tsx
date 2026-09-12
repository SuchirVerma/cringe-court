import { motion, useReducedMotion } from 'framer-motion';
import type { Verdict } from '../lib/types';
import { VerdictCard } from '../components/VerdictCard';
import { CourtroomBoundary } from '../components/CourtroomBoundary';
import { phase } from '../animations/framerVariants';

/**
 * The ruling, handed down.
 *
 * It enters above the evidence rather than below it: the order is the thing a
 * visitor came for, and the exhibits it rests on are still there underneath.
 * The card does its own unrolling; this wrapper only brings the phase in and,
 * when a new case opens, takes it away.
 */
export function VerdictPage({ verdict }: { verdict: Verdict }) {
  const reduced = useReducedMotion();

  return (
    <motion.section
      layout={reduced ? false : 'position'}
      variants={phase(reduced)}
      initial="hidden"
      animate="shown"
      exit="exit"
      className="mt-6"
      aria-label="Verdict"
    >
      <CourtroomBoundary section="the order">
        <VerdictCard verdict={verdict} />
      </CourtroomBoundary>
    </motion.section>
  );
}

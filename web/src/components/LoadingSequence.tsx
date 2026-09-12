import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { IMPACT, SETTLE } from '../animations/framerVariants';
import { Typewriter } from './Typewriter';

/**
 * The court coming to order.
 *
 * The gavel falls, the room shakes once, and the case file opens. It plays over
 * the real investigation, which has already started behind it: the overlay is
 * short and fixed, never waiting on the agent, so it can never be the reason a
 * demo stalls. If the agent is faster than the gavel, the feed is simply
 * already running when the overlay lifts.
 *
 * Reduced motion never mounts this at all; the parent calls straight through.
 */

const RISE_MS = 240;
const IMPACT_MS = 560;
const TOTAL_MS = 1560;

const EXHIBITS = ['A', 'B', 'C'];

export function LoadingSequence({
  host,
  onImpact,
  onDone,
}: {
  host: string;
  onImpact: () => void;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();
  const fired = useRef(false);

  useEffect(() => {
    if (reduced) {
      onDone();
      return;
    }
    const hit = window.setTimeout(() => {
      if (!fired.current) {
        fired.current = true;
        onImpact();
      }
    }, IMPACT_MS);
    const end = window.setTimeout(onDone, TOTAL_MS);
    return () => {
      window.clearTimeout(hit);
      window.clearTimeout(end);
    };
  }, [reduced, onImpact, onDone]);

  if (reduced) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden"
      style={{ background: 'var(--color-canvas)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ y: '-100%', transition: { duration: 0.62, ease: SETTLE } }}
      transition={{ duration: 0.18 }}
      role="status"
      aria-label="Opening the case file"
    >
      {/* Dust hanging in the light of a courtroom. */}
      <div className="chamber-dust" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} style={{ ['--i' as string]: i }} />
        ))}
      </div>

      <div className="relative flex flex-col items-center px-6">
        <GavelSlam />

        <motion.p
          className="mt-9 font-mono text-[0.72rem] uppercase tracking-[0.3em]"
          style={{ color: 'var(--color-ink-300)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: IMPACT_MS / 1000, duration: 0.2 }}
        >
          <Typewriter text="Case file opening" enabled />
        </motion.p>

        <p
          className="mt-2 max-w-[38ch] text-center text-[0.82rem]"
          style={{ color: 'var(--color-ink-600)' }}
        >
          In the matter of {host}
        </p>

        {/* The evidence tracker: the three charges about to be heard. */}
        <div className="mt-7 w-[min(320px,72vw)]">
          <div
            className="relative h-[3px] w-full overflow-hidden rounded-full"
            style={{ background: 'var(--color-panel-edge)' }}
          >
            <motion.div
              className="absolute inset-y-0 left-0 w-full origin-left rounded-full"
              style={{ background: 'var(--color-stamp)' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: IMPACT_MS / 1000, duration: (TOTAL_MS - IMPACT_MS) / 1000, ease: 'linear' }}
            />
          </div>
          <div className="mt-2 flex justify-between">
            {EXHIBITS.map((letter, i) => (
              <motion.span
                key={letter}
                className="font-mono text-[0.58rem] uppercase tracking-[0.2em]"
                style={{ color: 'var(--color-ink-700)' }}
                animate={{ color: ['var(--color-ink-700)', 'var(--color-ink-500)'] }}
                transition={{ delay: IMPACT_MS / 1000 + i * 0.28, duration: 0.3 }}
              >
                Exhibit {letter}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * The gavel itself. The head swings on the handle's pivot rather than sliding
 * down, which is what makes it read as a gavel and not a falling rectangle, and
 * the block takes the hit: it compresses a little and the ring leaves it.
 */
function GavelSlam() {
  return (
    <div className="relative grid place-items-center">
      <motion.div
        className="absolute h-24 w-24 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(176,55,36,0.5), transparent 70%)' }}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.5, 2.2], opacity: [0, 0.75, 0] }}
        transition={{ delay: IMPACT_MS / 1000, duration: 0.7, ease: 'easeOut' }}
        aria-hidden="true"
      />

      <svg width="124" height="110" viewBox="0 0 124 110" fill="none" aria-hidden="true">
        {/* The sound block, struck. */}
        <motion.g
          initial={{ scaleY: 1 }}
          animate={{ scaleY: [1, 0.82, 1] }}
          transition={{ delay: IMPACT_MS / 1000, duration: 0.34, ease: IMPACT }}
          style={{ transformOrigin: '62px 92px' }}
        >
          <rect x="30" y="84" width="64" height="10" rx="2.5" fill="var(--color-panel-edge)" />
          <rect x="38" y="94" width="48" height="5" rx="2" fill="var(--color-desk)" />
        </motion.g>

        {/* The gavel, raised and brought down on the handle's pivot. */}
        <motion.g
          initial={{ rotate: -46, y: -10, opacity: 0 }}
          animate={{ rotate: [-46, -52, 8, 2], y: [-10, -10, 0, 0], opacity: 1 }}
          transition={{
            duration: (IMPACT_MS + 220) / 1000,
            times: [0, RISE_MS / (IMPACT_MS + 220), IMPACT_MS / (IMPACT_MS + 220), 1],
            ease: IMPACT,
          }}
          style={{ transformOrigin: '96px 62px' }}
        >
          <rect
            x="56"
            y="52"
            width="46"
            height="16"
            rx="4"
            fill="var(--color-stamp)"
            stroke="var(--color-stamp-hover)"
            strokeWidth="1.5"
          />
          <rect x="66" y="46" width="8" height="28" rx="2.5" fill="var(--color-stamp-hover)" opacity="0.55" />
          <rect x="96" y="57" width="24" height="6" rx="3" fill="#7a6a52" />
        </motion.g>
      </svg>
    </div>
  );
}

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
 * The gavel itself.
 *
 * The head swings on the far end of the handle rather than sliding straight
 * down, which is what makes it read as a gavel being brought down and not a
 * rectangle falling. The geometry is set so that the head's underside meets the
 * block exactly at the resting angle: the pivot sits at (176, 112), the head's
 * centre 106px to its left, so every degree of rotation moves the head about
 * 1.8px vertically. Raised at -30 degrees it clears the block by some 50px;
 * settled at 4 degrees it is resting on it.
 *
 * The block takes the hit. It compresses once, and the ring leaves from the
 * point of contact rather than from the middle of the picture.
 */
function GavelSlam() {
  const impact = IMPACT_MS / 1000;

  return (
    <div className="relative grid place-items-center">
      <svg
        className="h-[clamp(140px,26vw,198px)] w-[clamp(146px,28vw,240px)]"
        viewBox="0 0 208 172"
        fill="none"
        aria-hidden="true"
      >
        {/* The strike ring, leaving the block where the head lands. */}
        <motion.circle
          cx="74"
          cy="128"
          r="26"
          fill="none"
          stroke="var(--color-stamp)"
          strokeWidth="2"
          initial={{ scale: 0.25, opacity: 0 }}
          animate={{ scale: [0.25, 1.6, 2.4], opacity: [0, 0.7, 0] }}
          transition={{ delay: impact, duration: 0.72, ease: 'easeOut' }}
          style={{ transformOrigin: '74px 128px' }}
        />

        {/* The sound block. */}
        <motion.g
          initial={{ scaleY: 1 }}
          animate={{ scaleY: [1, 0.78, 1] }}
          transition={{ delay: impact, duration: 0.36, ease: IMPACT }}
          style={{ transformOrigin: '74px 146px' }}
        >
          <rect x="30" y="130" width="88" height="14" rx="3.5" fill="var(--color-panel-edge)" />
          <rect x="42" y="144" width="64" height="7" rx="3" fill="var(--color-desk)" />
        </motion.g>

        {/* The gavel, raised and brought down on the handle's pivot. */}
        <motion.g
          initial={{ rotate: -30, opacity: 0 }}
          animate={{ rotate: [-30, -38, 7, 4], opacity: 1 }}
          transition={{
            duration: (IMPACT_MS + 240) / 1000,
            times: [0, RISE_MS / (IMPACT_MS + 240), IMPACT_MS / (IMPACT_MS + 240), 1],
            ease: IMPACT,
          }}
          style={{ transformOrigin: '176px 112px' }}
        >
          {/* The head: a barrel, with its two bands. */}
          <rect
            x="44"
            y="98"
            width="60"
            height="28"
            rx="7"
            fill="var(--color-stamp)"
            stroke="var(--color-stamp-hover)"
            strokeWidth="1.5"
          />
          <rect x="52" y="98" width="5" height="28" fill="var(--color-stamp-hover)" opacity="0.5" />
          <rect x="91" y="98" width="5" height="28" fill="var(--color-stamp-hover)" opacity="0.5" />

          {/* The handle, running from the head to the hand. */}
          <rect x="104" y="108" width="74" height="9" rx="4.5" fill="#8a7558" />
          <rect x="160" y="105" width="18" height="15" rx="5" fill="#7a6647" />
        </motion.g>
      </svg>
    </div>
  );
}

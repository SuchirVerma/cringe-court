import { motion, useReducedMotion } from 'framer-motion';
import type { Finding } from '../lib/types';

/**
 * The docket: all three charges, always on screen, with their live state.
 *
 * The log says what is happening now; this says what the whole case looks like.
 * Without it a visitor watching a 25 second run cannot tell whether the agent
 * is a third of the way through or nearly done, and a charge that resolves
 * quietly as inconclusive can slip past unnoticed.
 */

const ORDER = [
  { chargeId: 'FALSE_URGENCY', exhibit: 'A', label: 'False urgency' },
  { chargeId: 'BASKET_SNEAKING', exhibit: 'C', label: 'Basket sneaking' },
  { chargeId: 'SUBSCRIPTION_TRAP', exhibit: 'B', label: 'Subscription trap' },
];

const TONE: Record<string, { color: string; word: string }> = {
  violation: { color: 'var(--color-stamp)', word: 'Upheld' },
  clear: { color: 'var(--color-cleared)', word: 'Cleared' },
  inconclusive: { color: 'var(--color-unknown)', word: 'Unproven' },
};

export function ChargeDocket({
  findings,
  activeCharge,
  running,
}: {
  findings: Finding[];
  activeCharge: string | null;
  running: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="The charges">
      {ORDER.map((charge) => {
        const finding = findings.find((f) => f.chargeId === charge.chargeId);
        const isActive = activeCharge === charge.chargeId;
        const tone = finding ? TONE[finding.outcome] : null;

        const state = finding ? tone!.word : isActive ? 'Examining' : running ? 'Queued' : 'Not yet heard';

        return (
          <motion.li
            key={charge.chargeId}
            initial={false}
            animate={reduced ? {} : { opacity: finding || isActive ? 1 : 0.55 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2.5 rounded-[3px] border px-3 py-2.5"
            style={{
              borderColor: finding ? `color-mix(in srgb, ${tone!.color} 40%, transparent)` : 'var(--color-panel-edge)',
              background: 'var(--color-desk)',
            }}
          >
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-[0.62rem]"
              style={{
                borderColor: finding ? tone!.color : 'var(--color-panel-edge)',
                color: finding ? tone!.color : 'var(--color-ink-600)',
              }}
              aria-hidden="true"
            >
              {charge.exhibit}
            </span>

            <span className="min-w-0">
              <span
                className="block truncate text-[0.82rem]"
                style={{ color: finding || isActive ? 'var(--color-ink-100)' : 'var(--color-ink-500)' }}
              >
                {charge.label}
              </span>
              <span
                className="block font-mono text-[0.6rem] uppercase tracking-[0.14em]"
                style={{ color: finding ? tone!.color : 'var(--color-ink-600)' }}
              >
                {state}
                {isActive && !reduced && <PulseDots />}
              </span>
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}

function PulseDots() {
  return (
    <motion.span
      aria-hidden="true"
      className="ml-1 inline-block"
      animate={{ opacity: [0.25, 1, 0.25] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      •••
    </motion.span>
  );
}

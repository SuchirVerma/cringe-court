import { motion, useReducedMotion } from 'framer-motion';
import type { Finding, LogLine } from '../lib/types';
import { ChargeDocket } from '../components/ChargeDocket';
import { InvestigationFeed } from '../components/InvestigationFeed';
import { EvidenceCard } from '../components/EvidenceCard';
import { CourtroomBoundary } from '../components/CourtroomBoundary';
import { docketStack, phase } from '../animations/framerVariants';

/**
 * The hearing in progress: the docket, the case file, and the exhibits as they
 * land.
 *
 * This stays mounted once a case opens, through to the verdict and beyond. The
 * order is placed above it when it arrives and `layout` slides this section
 * down to make room, rather than unmounting and remounting it, so the feed
 * keeps its scroll position and the typed lines stay typed.
 */
export function InvestigationPage({
  target,
  error,
  findings,
  log,
  running,
  activeCharge,
}: {
  target: { host: string; tier: 1 | 2; siteName: string | null } | null;
  error: string | null;
  findings: Finding[];
  log: LogLine[];
  running: boolean;
  activeCharge: string | null;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.section
      layout={reduced ? false : 'position'}
      variants={phase(reduced)}
      initial="hidden"
      animate="shown"
      exit="exit"
      aria-label="Investigation"
    >
      {target && (
        <motion.p
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-5 font-mono text-[0.68rem]"
          style={{ color: 'var(--color-seal)' }}
        >
          {target.tier === 1
            ? `Recognised: ${target.siteName}. Using the learned site profile.`
            : `${target.host} is unfamiliar. Running the general analysis.`}
        </motion.p>
      )}

      {error && (
        <motion.div
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="mt-5 rounded-[3px] border px-4 py-3 text-[0.86rem]"
          style={{ borderColor: 'var(--color-stamp-muted)', background: 'rgba(194,64,44,0.07)', color: '#e7b6ac' }}
        >
          {error}
        </motion.div>
      )}

      {(running || findings.length > 0) && (
        <div className="mt-6">
          <ChargeDocket findings={findings} activeCharge={activeCharge} running={running} />
        </div>
      )}

      {(running || log.length > 0) && (
        <div className="mt-4">
          <InvestigationFeed lines={log} running={running} />
        </div>
      )}

      {findings.length > 0 && (
        <section className="mt-7" aria-label="Evidence">
          <h2
            className="font-mono text-[0.64rem] uppercase tracking-[0.2em]"
            style={{ color: 'var(--color-ink-500)' }}
          >
            The evidence
          </h2>
          {/*
            The stagger lives here, on the stack, so an exhibit arriving cannot
            restart the entrance of the ones already on the desk.
          */}
          <motion.div className="mt-3 space-y-4" variants={docketStack(reduced)} initial="hidden" animate="shown">
            {findings.map((finding, i) => (
              <CourtroomBoundary key={finding.chargeId} section="an exhibit">
                <EvidenceCard finding={finding} index={i} />
              </CourtroomBoundary>
            ))}
          </motion.div>
        </section>
      )}
    </motion.section>
  );
}

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useInvestigation } from './lib/useInvestigation';
import { useHealth } from './lib/useHealth';
import { PREVIEW_FINDINGS, PREVIEW_LOG, PREVIEW_VERDICT } from './lib/preview';
import { LoadingSequence } from './components/LoadingSequence';
import { URLInput } from './components/URLInput';
import { HomeHero } from './pages/Home';
import { InvestigationPage } from './pages/Investigation';
import { VerdictPage } from './pages/Verdict';

/**
 * ?preview=1 renders sample findings so the interface can be worked on without
 * spending a live agent run. Development builds only, and it announces itself,
 * because a demo has to be a real execution.
 */
const PREVIEW = import.meta.env.DEV && new URLSearchParams(location.search).has('preview');

/** The rigged checkout served by `npm run fixture` in the server folder. */
const FIXTURE_URL = 'http://localhost:8080/index.html';

/**
 * The hearing has three phases and they are not routes.
 *
 *   home           nothing has happened yet: title, introduction, the input
 *   investigation  a case is open: docket, case file, exhibits landing
 *   verdict        the order has been handed down and sits above the exhibits
 *
 * They are one page changing what it is for, because the demo needs the case
 * file to stay on screen while the exhibits land, and a route change would
 * throw it away. Framer's layout animations carry the input and the title
 * between positions, and AnimatePresence brings each phase's section in and out.
 */
type Phase = 'home' | 'investigation' | 'verdict';

export default function App() {
  const reduced = useReducedMotion();
  const [url, setUrl] = useState('');
  const live = useInvestigation();
  const { status, error, target, activeCharge, start, stop } = live;
  const running = status === 'running';
  const { unreachable, engineMissing, health } = useHealth();

  const log = PREVIEW ? PREVIEW_LOG : live.log;
  const findings = PREVIEW ? PREVIEW_FINDINGS : live.findings;
  const verdict = PREVIEW ? PREVIEW_VERDICT : live.verdict;

  const phase: Phase = verdict
    ? 'verdict'
    : running || log.length > 0 || findings.length > 0 || error
      ? 'investigation'
      : 'home';
  const open = phase !== 'home';

  /*
    The court coming to order. The overlay plays over an investigation that has
    already started, so the gavel never costs the demo a second: `start` is
    called first and the sequence runs on top of it.
  */
  const [opening, setOpening] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<number | null>(null);

  const onImpact = useCallback(() => {
    setShaking(true);
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShaking(false), 440);
  }, []);

  const onOpened = useCallback(() => setOpening(null), []);

  useEffect(
    () => () => {
      if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    },
    [],
  );

  /*
    A charge landing reddens the room once. It fires on the transition from
    "no violations yet" to "a violation has arrived", tracked by count rather
    than by watching the array, so a re-render can never fire it twice.
  */
  const [pulse, setPulse] = useState(0);
  const violationCount = findings.filter((f) => f.outcome === 'violation').length;
  const lastViolations = useRef(violationCount);

  useEffect(() => {
    if (violationCount > lastViolations.current && !reduced) {
      setPulse((n) => n + 1);
    }
    lastViolations.current = violationCount;
  }, [violationCount, reduced]);

  const startCase = (target: string) => {
    if (!target || running) return;
    start(target);
    if (!reduced) setOpening(target);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    startCase(url.trim());
  };

  /*
    Demo Mode: the bundled rigged checkout, tried as a real case. Same browser,
    same detectors, same gavel; only the defendant is one we control, so all
    three charges are found and the court returns guilty. The address is put in
    the field so the audience can see exactly what was investigated.
  */
  const onDemo = () => {
    setUrl(FIXTURE_URL);
    startCase(FIXTURE_URL);
  };

  return (
    <>
      <div className="desk-environment" aria-hidden="true" />
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <AnimatePresence>
        {opening && (
          <LoadingSequence key="opening" host={opening} onImpact={onImpact} onDone={onOpened} />
        )}
      </AnimatePresence>

      {/*
        One shot per charge. The key changes, so React swaps the element and the
        animation restarts from the top; it ends transparent and stays out of
        the way. Nothing removes it by hand: reaching into React's DOM to delete
        a node it still owns throws the next time it tries to touch it.
      */}
      {pulse > 0 && !reduced && <div key={pulse} className="gallery-pulse" aria-hidden="true" />}

      {/*
        The content sits in its own positioned layer above the fixed environment.
        Without this it is painted underneath it: a fixed element with z-index 0
        wins against static siblings, however far down the document they are.
      */}
      <div
        className={`relative z-10 mx-auto w-full max-w-[900px] px-5 pb-10 sm:px-8 sm:pb-14 ${
          shaking ? 'shake' : ''
        }`}
      >
        {/*
          On the home phase the title and input sit lower, with room above them,
          the way a title page does. When the case opens that room closes and
          everything rises to the top to make way for the hearing.
        */}
        <motion.div
          animate={{ paddingTop: open ? 40 : 112 }}
          initial={false}
          transition={reduced ? { duration: 0.001 } : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <HomeHero open={open} />
        </motion.div>

        <main id="main" tabIndex={-1} className="mt-7">
          {PREVIEW && (
            <p
              role="status"
              className="mb-5 rounded-[3px] border px-4 py-2.5 font-mono text-[0.7rem]"
              style={{ borderColor: 'var(--color-seal-muted)', color: 'var(--color-seal)' }}
            >
              Preview mode. These findings are sample data for interface work, not a real
              investigation.
            </p>
          )}

          {(unreachable || engineMissing) && (
            <div
              role="alert"
              className="mb-5 rounded-[3px] border px-4 py-3 text-[0.85rem] leading-relaxed"
              style={{ borderColor: 'var(--color-unknown)', background: 'rgba(155,140,106,0.08)', color: '#e0d3b4' }}
            >
              {unreachable ? (
                <>
                  The court server is not answering. Start it with{' '}
                  <code className="font-mono">npm start</code> in the <code className="font-mono">server</code> folder,
                  then reload.
                </>
              ) : (
                <>
                  The browser engine is not available, so investigations cannot run. Install it with{' '}
                  <code className="font-mono">npm install -g @agentrhq/webcmd</code> and run{' '}
                  <code className="font-mono">webcmd doctor</code> once.
                  {health?.engine.reason ? ` (${health.engine.reason})` : ''}
                </>
              )}
            </div>
          )}

          <URLInput
            url={url}
            onChange={setUrl}
            onSubmit={onSubmit}
            onStop={stop}
            onDemo={onDemo}
            running={running}
            compact={open}
          />

          {/*
            The order goes above the hearing it concludes. The investigation
            section stays mounted underneath through every phase after home, so
            the case file keeps its scroll and its typed lines; only the order
            enters and leaves.
          */}
          <AnimatePresence initial={false}>
            {phase === 'verdict' && verdict && <VerdictPage key={verdict.order?.caseNumber ?? 'order'} verdict={verdict} />}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {open && (
              <InvestigationPage
                key="hearing"
                target={target}
                error={error}
                findings={findings}
                log={log}
                running={running}
                activeCharge={activeCharge}
              />
            )}
          </AnimatePresence>
        </main>

        <footer
          className="mt-14 border-t border-[var(--color-panel-edge)] pt-5 text-[0.74rem] leading-relaxed"
          style={{ color: 'var(--color-ink-600)' }}
        >
          <p>
            Findings are observational: what the page showed, when it was observed, and which guideline
            it engages. They are not a legal determination, and a site may have changed since. Built
            for SLAB, hosted by webcmd.
          </p>
        </footer>
      </div>
    </>
  );
}

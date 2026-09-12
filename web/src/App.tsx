import { useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useInvestigation } from './lib/useInvestigation';
import { InvestigationFeed } from './components/InvestigationFeed';
import { EvidenceCard } from './components/EvidenceCard';
import { VerdictCard } from './components/VerdictCard';
import { ChargeDocket } from './components/ChargeDocket';
import { useHealth } from './lib/useHealth';
import { PREVIEW_FINDINGS, PREVIEW_LOG, PREVIEW_VERDICT } from './lib/preview';

const SUGGESTIONS = ['flipkart.com', 'myntra.com', 'swiggy.com', 'bookmyshow.com'];

/**
 * ?preview=1 renders sample findings so the interface can be worked on without
 * spending a live agent run. Development builds only, and it announces itself,
 * because a demo has to be a real execution.
 */
const PREVIEW = import.meta.env.DEV && new URLSearchParams(location.search).has('preview');

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

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim() || running) return;
    start(url.trim());
  };

  return (
    <>
      <div className="desk-environment" aria-hidden="true" />
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/*
        The content sits in its own positioned layer above the fixed environment.
        Without this it is painted underneath it: a fixed element with z-index 0
        wins against static siblings, however far down the document they are.
      */}
      <div className="relative z-10 mx-auto w-full max-w-[900px] px-5 py-10 sm:px-8 sm:py-14">
        <header>
          <div className="flex items-center gap-3">
            <Gavel />
            <p
              className="font-mono text-[0.64rem] uppercase tracking-[0.24em]"
              style={{ color: 'var(--color-ink-500)' }}
            >
              Dark patterns, on trial
            </p>
          </div>

          <h1
            className="mt-4 text-[2.6rem] leading-[0.98] sm:text-[3.4rem]"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink-100)' }}
          >
            CringeCourt
          </h1>

          <p
            className="mt-3 max-w-[64ch] text-[0.95rem] leading-relaxed"
            style={{ color: 'var(--color-ink-300)' }}
          >
            Paste a shopping or subscription site. A browser agent visits it, looks for the tricks
            that push people into spending, and reports back with the evidence and the guideline each
            one engages. It only looks. It never buys, pays, or cancels anything.
          </p>
        </header>

        <main id="main" tabIndex={-1} className="mt-8">
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

          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="url">
              Website address to investigate
            </label>
            <input
              id="url"
              type="text"
              inputMode="url"
              // Not autoComplete="url": the browser fills this from history and
              // the field then shows an address the user never typed, which
              // reads as the tool having gone somewhere on its own.
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="flipkart.com"
              disabled={running}
              className="flex-1 rounded-[3px] border border-[var(--color-panel-edge)] bg-[var(--color-desk)] px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-[var(--color-ink-600)] focus:border-[var(--color-stamp)] disabled:opacity-60"
              style={{ color: 'var(--color-ink-100)' }}
            />
            <button
              type="submit"
              disabled={running || !url.trim()}
              className="rounded-[3px] px-6 py-3 text-[0.9rem] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: 'var(--color-stamp)', color: '#fdf6ee' }}
            >
              {running ? 'Court in session…' : 'Open the case'}
            </button>

            {running && (
              <button
                type="button"
                onClick={stop}
                className="rounded-[3px] border px-4 py-3 text-[0.85rem] transition-colors"
                style={{ borderColor: 'var(--color-panel-edge)', color: 'var(--color-ink-300)' }}
              >
                Adjourn
              </button>
            )}
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="font-mono text-[0.62rem] uppercase tracking-[0.16em]"
              style={{ color: 'var(--color-ink-600)' }}
            >
              Try
            </span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setUrl(s)}
                disabled={running}
                className="rounded-full border border-[var(--color-panel-edge)] px-3 py-1 font-mono text-[0.66rem] transition-colors hover:border-[var(--color-seal)] disabled:opacity-40"
                style={{ color: 'var(--color-ink-500)' }}
              >
                {s}
              </button>
            ))}
          </div>

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
              <div className="mt-3 space-y-4">
                {findings.map((finding, i) => (
                  <EvidenceCard key={finding.chargeId} finding={finding} index={i} />
                ))}
              </div>
            </section>
          )}

          {verdict && (
            <div className="mt-7">
              <VerdictCard verdict={verdict} />
            </div>
          )}
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

function Gavel() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M7 25h18M11 9l10 3M13.5 10.2 9 18h8zM19 12.5 15 20h8z"
        stroke="var(--color-stamp)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import { motion, useReducedMotion } from 'framer-motion';
import type { FormEvent } from 'react';

/**
 * The one thing the visitor does: name a defendant.
 *
 * The button carries a gavel that lifts as you hover and comes down as you
 * press, so the action reads as the court being asked to sit rather than a
 * form being posted. Focus glows in the stamp colour; the field itself never
 * glows at rest, because a glow that is always on is not a glow.
 *
 * `layout` on the form lets it travel: centred under the introduction on the
 * home phase, tucked up under the header once the case is open. It is the
 * same element throughout, so Framer animates the move rather than swapping
 * one input for another and losing what was typed.
 */

const SUGGESTIONS = ['flipkart.com', 'myntra.com', 'swiggy.com', 'bookmyshow.com'];

export function URLInput({
  url,
  onChange,
  onSubmit,
  onStop,
  running,
  compact,
}: {
  url: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onStop: () => void;
  running: boolean;
  /** True once a case is open: quieter, no suggestions. */
  compact: boolean;
}) {
  const reduced = useReducedMotion();
  const ready = url.trim().length > 0 && !running;

  return (
    <motion.div layout={reduced ? false : 'position'} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row" aria-label="Name a website to investigate">
        <label className="sr-only" htmlFor="url">
          Website address to investigate
        </label>
        <input
          id="url"
          type="text"
          inputMode="url"
          // Not autoComplete="url": the browser fills this from history and the
          // field then shows an address the user never typed, which reads as
          // the tool having gone somewhere on its own.
          autoComplete="off"
          spellCheck={false}
          value={url}
          onChange={(e) => onChange(e.target.value)}
          placeholder="flipkart.com"
          disabled={running}
          className="url-field flex-1 rounded-[3px] border border-[var(--color-panel-edge)] bg-[var(--color-desk)] px-4 py-3 text-[0.95rem] outline-none placeholder:text-[var(--color-ink-600)] disabled:opacity-60"
          style={{ color: 'var(--color-ink-100)' }}
        />

        <motion.button
          type="submit"
          disabled={!ready}
          className="investigate inline-flex items-center justify-center gap-2.5 rounded-[3px] px-5 py-3 text-[0.9rem] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          style={{ background: 'var(--color-stamp)', color: '#fdf6ee' }}
          whileHover={ready && !reduced ? { scale: 1.02 } : undefined}
          whileTap={ready && !reduced ? { scale: 0.98 } : undefined}
          transition={{ duration: 0.18 }}
        >
          <GavelIcon />
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.2em]">
            {running ? 'In session' : 'Investigate'}
          </span>
        </motion.button>

        {running && (
          <motion.button
            type="button"
            onClick={onStop}
            initial={reduced ? { opacity: 1 } : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-[3px] border px-4 py-3 text-[0.85rem] transition-colors hover:border-[var(--color-ink-500)]"
            style={{ borderColor: 'var(--color-panel-edge)', color: 'var(--color-ink-300)' }}
          >
            Adjourn
          </motion.button>
        )}
      </form>

      {!compact && (
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
              onClick={() => onChange(s)}
              disabled={running}
              className="rounded-full border border-[var(--color-panel-edge)] px-3 py-1 font-mono text-[0.66rem] transition-colors hover:border-[var(--color-seal)] disabled:opacity-40"
              style={{ color: 'var(--color-ink-500)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/**
 * The gavel on the button. The head swings on the handle's end (the CSS in
 * index.css animates `.investigate:hover .gavel-head`), which is what makes it
 * read as a gavel about to come down and not a decoration next to a word.
 */
function GavelIcon() {
  return (
    <svg className="gavel-icon" width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M7 26h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <g className="gavel-head">
        <rect x="9" y="8" width="12" height="6" rx="1.6" transform="rotate(-35 15 11)" fill="currentColor" />
        <path d="M19 13.5 25.5 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

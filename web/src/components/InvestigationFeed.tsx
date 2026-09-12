import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { LogLine } from '../lib/types';
import { Typewriter } from './Typewriter';

/**
 * The agent thinking out loud.
 *
 * This is the reliability story made visible: every retry, every fallback, every
 * "recognised site" moment lands here as a line. It autoscrolls, but only when
 * the reader is already at the bottom, so scrolling back to read something does
 * not get yanked away.
 */

export function InvestigationFeed({ lines, running }: { lines: LogLine[]; running: boolean }) {
  const reduced = useReducedMotion();
  const boxRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !pinned.current) return;
    box.scrollTop = box.scrollHeight;

    /*
      The newest line is still typing, so it grows after this effect has run and
      can push itself under the fold. Follow it while it types, then stop: a
      short rAF loop rather than a timer, so it costs nothing once it is done.
    */
    let frame = 0;
    const until = performance.now() + 560;
    const follow = (now: number) => {
      if (!pinned.current || now > until) return;
      box.scrollTop = box.scrollHeight;
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [lines]);

  const onScroll = () => {
    const box = boxRef.current;
    if (!box) return;
    pinned.current = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  };

  return (
    <section
      className="rounded-[3px] border border-[var(--color-panel-edge)] bg-[var(--color-desk)]"
      aria-label="Investigation log"
    >
      <header className="flex items-center gap-2.5 border-b border-[var(--color-panel-edge)] px-4 py-2.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse' : ''}`}
          style={{ background: running ? 'var(--color-stamp)' : 'var(--color-ink-700)' }}
          aria-hidden="true"
        />
        <h2
          className="font-mono text-[0.66rem] uppercase tracking-[0.2em]"
          style={{ color: 'var(--color-ink-500)' }}
        >
          Case file · live
        </h2>
      </header>

      <div
        ref={boxRef}
        onScroll={onScroll}
        className="max-h-[340px] min-h-[120px] overflow-y-auto px-4 py-3"
        role="log"
        aria-live="polite"
      >
        {lines.length === 0 && (
          <p className="feed-line" style={{ color: 'var(--color-ink-600)' }}>
            Waiting for a URL. The court sits when you give it a defendant.
          </p>
        )}

        <AnimatePresence initial={false}>
          {lines.map((line, i) => (
            <motion.p
              key={line.id}
              initial={reduced ? { opacity: 1 } : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduced ? { duration: 0.001 } : { duration: 0.24, ease: 'easeOut' }}
              className="feed-line flex gap-2.5"
              style={{ color: line.level === 'warn' ? 'var(--color-unknown)' : 'var(--color-ink-300)' }}
            >
              <span aria-hidden="true" style={{ color: 'var(--color-ink-700)' }}>
                ›
              </span>
              {/*
                Only the newest line types. Everything above it is already on the
                record, and a page of text retyping itself on every new line
                would be unreadable.
              */}
              <span className="min-w-0">
                <Typewriter text={line.message} enabled={i === lines.length - 1} />
              </span>
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

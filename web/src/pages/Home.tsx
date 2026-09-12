import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { fold } from '../animations/framerVariants';

/**
 * The first thing on screen, and the header once the case opens.
 *
 * These are one component because they are one thing at two moments. On the
 * home phase the title sits large with its introduction under it; once a case
 * is open the introduction folds away, its height collapsing so the input rises
 * to meet the title rather than leaving a gap where the words were. The title
 * itself never remounts, so there is no flash, and `layout` on it lets Framer
 * carry the size change rather than cutting between two headings.
 */
export function HomeHero({ open }: { open: boolean }) {
  const reduced = useReducedMotion();

  return (
    <header>
      <div className="flex items-center gap-3">
        <GavelMark />
        <p
          className="font-mono text-[0.64rem] uppercase tracking-[0.24em]"
          style={{ color: 'var(--color-ink-500)' }}
        >
          Dark patterns, on trial
        </p>
      </div>

      <motion.h1
        layout={reduced ? false : 'position'}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={
          open
            ? 'mt-3 text-[2.2rem] leading-[0.98] sm:text-[2.8rem]'
            : 'mt-4 text-[2.8rem] leading-[0.96] sm:text-[4.2rem]'
        }
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink-100)' }}
      >
        CringeCourt
      </motion.h1>

      <AnimatePresence initial={false}>
        {!open && (
          <motion.div
            key="intro"
            variants={fold(reduced)}
            initial="exit"
            animate="shown"
            exit="exit"
            className="overflow-hidden"
          >
            <p
              className="mt-4 max-w-[62ch] text-[1rem] leading-relaxed sm:text-[1.05rem]"
              style={{ color: 'var(--color-ink-300)' }}
            >
              Paste a shopping or subscription site. A browser agent visits it, looks for the tricks
              that push people into spending, and reports back with the evidence and the guideline
              each one engages. It only looks. It never buys, pays, or cancels anything.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function GavelMark() {
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

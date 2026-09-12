import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * A line of the case file being typed onto the page.
 *
 * Two things make this honest rather than decorative:
 *
 * Screen readers get the finished sentence, once. The typed copy is
 * aria-hidden and a complete visually-hidden copy sits beside it, because a
 * live region receiving one character at a time announces the same line a
 * hundred times.
 *
 * It is always faster than the agent. Long lines type quicker per character so
 * the whole line lands inside a fixed budget, and a line that is no longer the
 * newest finishes instantly. The animation can never be the reason a demo
 * looks slow.
 */

const BUDGET_MS = 480;
const MIN_STEP_MS = 7;
const MAX_STEP_MS = 20;

export function Typewriter({ text, enabled }: { text: string; enabled: boolean }) {
  const reduced = useReducedMotion();
  const instant = reduced || !enabled;

  const [shown, setShown] = useState(() => (instant ? text.length : 0));
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }

    if (instant) {
      setShown(text.length);
      return;
    }

    setShown(0);
    const step = Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, BUDGET_MS / Math.max(1, text.length)));
    // Characters per tick, so a long line does not need a tick per character.
    const chunk = Math.max(1, Math.ceil(text.length / (BUDGET_MS / step)));

    timer.current = window.setInterval(() => {
      setShown((n) => {
        const next = n + chunk;
        if (next >= text.length) {
          if (timer.current !== null) {
            window.clearInterval(timer.current);
            timer.current = null;
          }
          return text.length;
        }
        return next;
      });
    }, step);

    return () => {
      if (timer.current !== null) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [text, instant]);

  const typing = shown < text.length;

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, shown)}
        {typing && <span className="caret" />}
      </span>
    </>
  );
}

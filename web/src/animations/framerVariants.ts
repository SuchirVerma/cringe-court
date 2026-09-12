import type { Transition, Variants } from 'framer-motion';

/**
 * One motion vocabulary for the whole courtroom.
 *
 * Two curves, used everywhere, matching the CSS tokens in index.css so a
 * transition written in CSS and one written here settle identically:
 *
 *   SETTLE — things arriving and coming to rest. Never overshoots.
 *   IMPACT — things landing with weight. Overshoots once, on purpose.
 *
 * Everything below animates transform and opacity only, so nothing here can
 * drag a repaint. Each variant set takes `reduced` and returns the finished
 * state with no travel, rather than relying on a blanket motion kill, because
 * a blanket rule leaves staggered children waiting on delays that never fire.
 */

export const SETTLE = [0.22, 1, 0.36, 1] as const;
export const IMPACT = [0.34, 1.56, 0.64, 1] as const;

/** Reduced motion still animates, just imperceptibly, so callbacks still run. */
export const INSTANT: Transition = { duration: 0.001 };

/**
 * A stack of exhibits laid onto the desk one after another.
 *
 * The stagger lives on the container so the cards themselves stay ignorant of
 * their own index, which means a card re-rendering mid-investigation (a new
 * finding arriving above it) cannot restart its neighbours' entrances.
 */
export function docketStack(reduced: boolean | null): Variants {
  return {
    hidden: {},
    shown: {
      transition: reduced ? { staggerChildren: 0 } : { staggerChildren: 0.14, delayChildren: 0.06 },
    },
  };
}

/**
 * One exhibit landing: it rises, and the slight rotation it carried in the air
 * settles to almost-square. Paper never lands perfectly straight.
 */
export function exhibitDrop(reduced: boolean | null, index: number): Variants {
  const rest = index % 2 === 0 ? -0.35 : 0.4;
  if (reduced) {
    return {
      hidden: { opacity: 0, y: 0, rotate: rest },
      shown: { opacity: 1, y: 0, rotate: rest, transition: INSTANT },
    };
  }
  return {
    hidden: { opacity: 0, y: 26, rotate: index % 2 === 0 ? -2.4 : 2.6 },
    shown: {
      opacity: 1,
      y: 0,
      rotate: rest,
      transition: { duration: 0.55, ease: SETTLE },
    },
  };
}

/**
 * An exhibit turned face-up on the desk.
 *
 * The 3D flip, done as paper does it: the card arrives edge-on and rotates
 * about its top edge until it lies flat, rather than spinning on its vertical
 * axis like a playing card, because a filed document is turned over, not
 * twirled. It carries the same slight off-square rest as the drop, so a
 * flipped exhibit and a dropped one sit on the same desk.
 *
 * `transformPerspective` lives on the element itself so no parent needs a
 * perspective container, and the stamp's own delay still lands after the paper
 * has settled.
 */
export function exhibitFlip(reduced: boolean | null, index: number): Variants {
  const rest = index % 2 === 0 ? -0.35 : 0.4;
  if (reduced) {
    return {
      hidden: { opacity: 0, rotateX: 0, y: 0, rotate: rest, transformPerspective: 900 },
      shown: { opacity: 1, rotateX: 0, y: 0, rotate: rest, transformPerspective: 900, transition: INSTANT },
    };
  }
  return {
    hidden: { opacity: 0, rotateX: -84, y: 22, rotate: 0, transformPerspective: 900 },
    shown: {
      opacity: 1,
      rotateX: 0,
      y: 0,
      rotate: rest,
      transformPerspective: 900,
      transition: { duration: 0.72, ease: SETTLE },
    },
  };
}

/**
 * A phase of the hearing entering or leaving the room.
 *
 * Home, investigation and verdict are not routes, they are the same page
 * changing what it is for. Each phase's section rises in and, when it goes,
 * lifts away a little faster than it arrived, so the thing replacing it never
 * waits on the thing it replaces.
 */
export function phase(reduced: boolean | null): Variants {
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      shown: { opacity: 1, transition: INSTANT },
      exit: { opacity: 0, transition: INSTANT },
    };
  }
  return {
    hidden: { opacity: 0, y: 26 },
    shown: { opacity: 1, y: 0, transition: { duration: 0.55, ease: SETTLE } },
    exit: { opacity: 0, y: -14, transition: { duration: 0.28, ease: 'easeIn' } },
  };
}

/**
 * The introduction folding away when the case opens. Height collapses so the
 * input rises to meet the header rather than leaving a hole behind.
 */
export function fold(reduced: boolean | null): Variants {
  if (reduced) {
    return {
      shown: { opacity: 1, height: 'auto', transition: INSTANT },
      exit: { opacity: 0, height: 0, transition: INSTANT },
    };
  }
  return {
    shown: { opacity: 1, height: 'auto', transition: { duration: 0.45, ease: SETTLE } },
    exit: { opacity: 0, height: 0, transition: { duration: 0.36, ease: SETTLE } },
  };
}

/** A line of the case file sliding in from the margin. */
export function feedLine(reduced: boolean | null): Variants {
  if (reduced) {
    return { hidden: { opacity: 0, x: 0 }, shown: { opacity: 1, x: 0, transition: INSTANT } };
  }
  return {
    hidden: { opacity: 0, x: -6 },
    shown: { opacity: 1, x: 0, transition: { duration: 0.24, ease: 'easeOut' } },
  };
}

/**
 * The order unrolling: it grows from its top edge rather than fading, so the
 * document reads as being unrolled onto the desk. The origin is set in the
 * component, because transform-origin is not animatable state.
 */
export function unroll(reduced: boolean | null): Variants {
  if (reduced) {
    return {
      hidden: { opacity: 0, scaleY: 1 },
      shown: { opacity: 1, scaleY: 1, transition: INSTANT },
    };
  }
  return {
    hidden: { opacity: 0, scaleY: 0.86, y: 18 },
    shown: {
      opacity: 1,
      scaleY: 1,
      y: 0,
      transition: { duration: 0.72, ease: SETTLE, staggerChildren: 0.09, delayChildren: 0.26 },
    },
  };
}

/** A clause of the order settling in after the paper has finished unrolling. */
export function clause(reduced: boolean | null): Variants {
  if (reduced) {
    return { hidden: { opacity: 0, y: 0 }, shown: { opacity: 1, y: 0, transition: INSTANT } };
  }
  return {
    hidden: { opacity: 0, y: 10 },
    shown: { opacity: 1, y: 0, transition: { duration: 0.42, ease: SETTLE } },
  };
}

import { useScroll, useSpring, useTransform, useReducedMotion, type MotionValue } from 'framer-motion';
import type { RefObject } from 'react';

/**
 * Scroll-driven reading of the court order.
 *
 * The order is a physical document: its masthead sticks to the top of the page
 * while the clauses pass under it (that part is plain CSS `position: sticky`,
 * which cannot break), and the margin rule down its spine fills as you read.
 *
 * The fill is the only scroll-driven value, and it is deliberately not the
 * thing that reveals the content. A reveal tied to scroll can leave a visitor
 * looking at a half-drawn document if they never scroll, which on a live demo
 * reads as a broken page. The content arrives on its own; scroll only draws
 * the margin.
 */

export interface OrderScroll {
  /** 0 at the moment the order's top reaches the bottom of the viewport, 1 when its bottom leaves the top. */
  progress: MotionValue<number>;
  /** The margin rule's vertical scale, origin top. */
  ruleScale: MotionValue<number>;
  /** The seal drifts a few pixels against the scroll, so the paper has depth. */
  sealDrift: MotionValue<number>;
}

export function useOrderScroll(ref: RefObject<HTMLElement | null>): OrderScroll {
  const reduced = useReducedMotion();

  /*
    The order is the last thing on the page, so it never scrolls up and out:
    "end start" (its bottom leaving the top of the screen) is a position the
    document cannot reach, and a rule mapped to it would stall short of full.
    So progress runs from "its top enters the bottom of the screen" to "its
    bottom reaches the bottom of the screen", which is exactly the stretch over
    which the order is actually read, and which the page can always reach.
  */
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end end'],
  });

  // Smoothed, so a trackpad's jitter does not show up in the rule.
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 28,
    restDelta: 0.001,
  });

  /*
    It starts filling once the order is properly on screen rather than the
    instant its first pixel appears, and is full by the time the reader reaches
    the foot of it.
  */
  const ruleScale = useTransform(progress, [0.12, 0.92], [0, 1], { clamp: true });
  const sealDrift = useTransform(progress, [0, 1], [10, -10]);

  // Hooks above run unconditionally; reduced motion gets finished values.
  const still = useTransform(progress, () => 1);
  const noDrift = useTransform(progress, () => 0);

  return reduced
    ? { progress, ruleScale: still, sealDrift: noDrift }
    : { progress, ruleScale, sealDrift };
}

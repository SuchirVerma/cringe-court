/**
 * One vocabulary for "we could not".
 *
 * Every detector meets the same three walls: a page that timed out, a page
 * that answered with a bot check instead of content, and a page that simply
 * was not there. Each used to describe them in its own words, so the same
 * wall read differently depending on which exhibit hit it. These helpers give
 * the walls their names once, and every "unproven" that comes from one of them
 * says which it was in its first two words.
 */

const TIMEOUT = /timed out|timeout|exceeded \d+ms|did not (open|respond) within/i;
const BLOCKED = /captcha|not a robot|verify (that )?you are (a )?human|access denied|unusual traffic|automated access|bot check|blocked/i;

/**
 * What kind of wall a failure reason describes.
 * Returns 'timeout' | 'bot-protection' | 'not-found' | 'unreadable'.
 */
export function classifyFailure(reason, data = null) {
  if (data?.botCheck) return 'bot-protection';
  if (data?.notFound) return 'not-found';
  const text = String(reason || '');
  if (TIMEOUT.test(text)) return 'timeout';
  if (BLOCKED.test(text)) return 'bot-protection';
  return 'unreadable';
}

/**
 * The reason line for an unproven charge that ended at one of the walls.
 * `what` is the thing we were trying to reach, in plain words: "the cart",
 * "the subscription area", "the page".
 */
export function wallReason(kind, what, detail = '') {
  const tail = detail ? ` ${detail}`.replace(/\s+/g, ' ').trimEnd() : '';
  switch (kind) {
    case 'timeout':
      return `Timeout: ${what} did not finish loading inside the time allowed, so it could not be examined.${tail}`;
    case 'bot-protection':
      return `Bot protection: ${what} answered with a verification page instead of content. This tool does not try to get past that, so the charge cannot be judged.${tail}`;
    case 'not-found':
      return `Not found: ${what} was not at any of the addresses tried.${tail}`;
    default:
      return `Could not read ${what}.${tail}`;
  }
}

/** True when a page program's body text is a bot check rather than a site. */
export const BOT_CHECK_PATTERN = BLOCKED;

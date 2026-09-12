# CringeCourt

**An AI browser agent that puts dark patterns on trial.**

Paste a URL. CringeCourt opens a real browser, investigates the site for manipulative
UX tactics, and delivers its findings as a courtroom trial: live investigation feed,
evidence cards as violations surface, and a final verdict backed by India's CCPA
*Guidelines for Prevention and Regulation of Dark Patterns, 2023*.

It observes and reports. It never buys, pays, or cancels anything.

## The three charges

| # | Dark pattern | How it is detected |
|---|---|---|
| 1 | **False urgency** | Finds countdown-like elements, reads the value, waits, reads again, and flags timers that reset or refuse to fall. |
| 2 | **Subscription trap** | Walks from account/settings toward a cancel action, counting steps. Flags flows deeper than 3 steps or hidden behind vague labels. |
| 3 | **Basket sneaking** | Scans cart/checkout for pre-ticked checkboxes sitting next to a price, and for line items that appeared without an add-to-cart. |

## Two-tier detection

- **Tier 1 — named sites.** Amazon India, Flipkart, Myntra, Zomato, Swiggy, BookMyShow.
  webcmd explores each one and keeps a learned site profile, so repeat runs are fast
  and high-confidence.
- **Tier 2 — anything else.** Generic structural detection using the same conceptual
  patterns with no site-specific selectors, so an unfamiliar URL still gets a real,
  honest attempt.

Both tiers emit the same evidence schema. The frontend never knows which ran.

## Every check always resolves

A check resolves to exactly one of three states, on every site, every time:

- `violation` — the evidence card
- `clear` — checked, nothing found. A real result, shown as such.
- `inconclusive` — bot protection, unusual structure, timeout. Reported with a reason.

Never a crash, never a silent hang. This is treated as a hard requirement equal to the
detections themselves.

The interface keeps the same promise. A render fault is caught at the section it
happened in and reported in the court's own voice, so one malformed payload can never
take the whole page down and lose the investigation behind it.

## The hearing, as staged

The trial is a sequence, and each beat is a real moment in the investigation rather than
a loading screen with decoration on it:

| Beat | What happens |
|---|---|
| **The gavel** | The court comes to order: the gavel falls, the room shakes once, and the evidence tracker names the three charges about to be heard. It plays *over* an investigation that has already started, and lasts a fixed 1.5s, so it can never be the reason a demo waits. |
| **The case file** | Each line of the agent's reasoning types itself onto the record. Only the newest line types; the ones above it are already on the record. |
| **The charge landing** | A violation reddens the room once, then lets go. |
| **The exhibits** | Each one drops onto the desk and the stamp lands on it, slightly off-square, the way paper actually falls. |
| **The order** | It unrolls from its top edge, its masthead stays with you as the clauses pass under it, and the rule down its margin fills as you read. |

Every one of them is transform and opacity only, and every one has a finished state with
no travel under `prefers-reduced-motion`. Reduced motion is honoured live and in both
directions: no gavel, no shake, no dust, no typing, everything already settled.

The order's reveal is deliberately tied to the verdict arriving, not to scroll position.
A scroll-driven reveal can leave a visitor looking at a half-drawn document if they never
scroll, which on a live demo reads as a broken page. Scroll only draws the margin rule,
which is decoration and safe to leave unfinished.

## Tech stack

- **Browser automation:** [webcmd](https://github.com/agentrhq/webcmd) (`@agentrhq/webcmd`)
  with Playwright underneath, driving sandboxed page programs against named sessions.
- **Backend:** Node + Express, streaming the investigation over Server-Sent Events.
- **Frontend:** React + Vite + TypeScript + Tailwind, animated with Framer Motion.
  The reusable motion vocabulary lives in `web/src/animations/`: `framerVariants.ts`
  holds the two easing curves and every entrance built on them, `scrollTriggers.ts`
  holds the scroll-driven reading of the order.

The court's seal and the gavel are drawn as inline SVG rather than generated images:
they stay crisp at any size, take the verdict's own colour, and add nothing to the
page weight.

Folder names map to the brief as `web/` = frontend, `server/` = backend.

## Running it locally

Requires Node.js 20.6+.

```bash
# once, globally
npm install -g @agentrhq/webcmd
webcmd skills add
webcmd doctor        # first run downloads a ~140 MB browser engine; let it finish

# install project dependencies
cd server && npm install
cd ../web && npm install

# two terminals
cd server && npm run dev     # http://localhost:8787
cd web && npm run dev        # http://localhost:5173
```

Open the web app, paste a URL, and press **Open the case**.

If `webcmd` is not on your PATH after a global install, check where npm put it
(`npm prefix -g`) and link it: `ln -sf "$(npm prefix -g)/bin/webcmd" ~/.local/bin/webcmd`.

### Seeing it find something

Real storefronts hide their carts and subscription pages behind a sign-in, so a
signed-out run on Amazon or Flipkart mostly reports what it could not determine.
That is the tool being honest, but it is a poor first look. Run it against the
bundled rigged checkout instead:

```bash
cd server && npm run fixture     # serves the rigged page on :8080
```

Then investigate `http://localhost:8080/index.html`. It returns guilty on all
three counts in around 18 seconds, with the evidence quoted from the page.

The same page is the regression target, so those three convictions are asserted
by `npm run test:live` rather than being a happy-path demo.

## Testing

```bash
cd server
npm test          # logic: tier routing, the always-resolves guarantee, scoring
npm run fixture   # serves test-site/ on :8080 (separate terminal)
npm run test:live # runs all three detectors against the fixture
```

`test-site/` is a deliberately rigged checkout page with known answers. It carries
a timer that never moves *beside one that honestly counts down*, a pre-ticked
₹149 charge *beside a terms box that must not be charged*, and a cancel flow
buried four links deep. The live test asserts both the violations and the two
false-positive traps, plus that the cancellation page is never actually opened.

## Layout

```
server/
  src/
    index.js              Express app, SSE endpoint
    investigate.js        orchestrates the three charges, guarantees resolution
    webcmd.js             webcmd session lifecycle + browser run wrapper
    sites.js              Tier 1 named-site registry
    law.js                CCPA dark pattern categories
    verdict.js            scoring and the final verdict
    detectors/            one module per charge, Tier 1 + Tier 2 paths
  browser-programs/       sandboxed page programs sent to `webcmd browser run`
web/
  src/                    the courtroom
```

## Scope and ethics

Read-only. No purchases, no payment details, no real cancellations, no account changes.
Runs against the operator's own accounts and respects each platform's terms. Evidence is
observational: what the page showed, when it was observed, and which guideline it engages.

## Licence

Unlicensed hackathon project, built for SLAB (hosted by webcmd).

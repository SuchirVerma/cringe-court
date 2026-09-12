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

## Tech stack

- **Browser automation:** [webcmd](https://github.com/agentrhq/webcmd) (`@agentrhq/webcmd`)
  with Playwright underneath, driving sandboxed page programs against named sessions.
- **Backend:** Node + Express, streaming the investigation over Server-Sent Events.
- **Frontend:** React + Vite + TypeScript + Tailwind, animated with Framer Motion.

## Running it locally

Requires Node.js 20.6+.

```bash
# once, globally
npm install -g @agentrhq/webcmd
webcmd skills add

# install project dependencies
cd server && npm install
cd ../web && npm install

# two terminals
cd server && npm run dev     # http://localhost:8787
cd web && npm run dev        # http://localhost:5173
```

Open the web app, paste a URL, and press **Open the case**.

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

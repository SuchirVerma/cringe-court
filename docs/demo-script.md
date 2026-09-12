# CringeCourt — Demo Script & Checklist

Target length: 3:30. Practise it twice with a timer; the investigation itself
takes ~19 seconds, so the pacing below leaves room for the gavel to land and
the exhibits to flip before you speak over them.

---

## The script

### 0:00 – 0:30 · The problem

> Every one of us has seen a countdown that never ends. "Offer ends in 2:59" —
> refresh, still 2:59. A protection plan already ticked in your cart. A
> subscription you can join in one click and cancel in seven.
>
> These are dark patterns. India banned thirteen of them in 2023 under the
> CCPA Guidelines. But nobody checks. There's no inspector. So we built one —
> and we made it a courtroom.
>
> This is CringeCourt. Paste a URL, and an AI browser agent puts the site on
> trial.

*(Screen: CringeCourt home phase. Don't touch anything yet.)*

### 0:30 – 1:40 · Demo Mode — the trial

> Let me show you a hearing. This is a real browser run against a checkout
> page we built to be caught.

**→ Click 🎬 Demo Mode.** Say nothing for the gavel. When the feed starts:

> The agent is a browser — it's actually loading the page. Watch the case
> file: it found a countdown, and now it's *waiting six seconds* to see if the
> clock moves. That's the whole trick. Real deadlines fall. Fake ones don't.

*(Exhibit A flips face-up.)*

> Guilty. It quotes both readings — same time, six seconds apart — and it
> notices the *honest* timer next to it counted down correctly. So this isn't
> a page-wide glitch. It's the fake one.

*(Exhibit C lands.)*

> Pre-ticked protection plan, ₹149, nobody ticked it. And it checked the terms
> box beside it and *didn't* charge that one — a ticked terms box is legal.

*(Exhibit B lands.)*

> Inside a signed-in account, no cancel control anywhere. Not buried —
> absent.

*(The order unrolls, stamp lands.)*

> Guilty on all three counts. Two out of ten. And the order isn't just a
> score — it's court orders: what a compliant version would do. Every charge
> cites the exact CCPA annexure clause.

### 1:40 – 2:30 · Live site — the honesty

> Now a real site, live, no preparation.

**→ Type `flipkart.com`, click Investigate.**

> Recognised — Flipkart is one of six named sites it has *explored and
> learned*: where the cart lives, where the subscription page is, which
> addresses 404. Watch what it does when it can't see something.

*(Wait for results — ~25s. Fill with:)*

> Signed out, the cart's empty and the account's behind a login wall. So it
> says exactly that: **unproven** — and it refuses to score the site. It will
> not hand out a 10/10 for a checkout nobody actually examined. Every
> verdict is only what the browser actually saw.
>
> That's the part we're proudest of. It never crashes, never guesses, and it
> tells you *where it looked* and *why it stopped*.

### 2:30 – 3:10 · How it works

> Three pieces. **webcmd** drives a real Chromium — every check is a real
> page, real DOM, real time elapsed. A **Node backend** runs three
> independent detectors, each one bounded, each one guaranteed to resolve:
> violation, cleared, or unproven with a reason. Never a crash. And a **React
> + Framer Motion** front end that stages it as a hearing.
>
> Two tiers: six named Indian sites with learned profiles, and a generic
> structural fallback for any URL you paste — same detectors, same honesty.
>
> Everything is read-only. It never buys, never pays, never cancels, never
> signs in with an account it wasn't given.

### 3:10 – 3:30 · Impact & close

> Dark patterns work because they're invisible at scale. This makes them
> visible — with evidence a regulator could act on, and a fix list a product
> team could ship tomorrow.
>
> Paste a URL. Put it on trial. Thank you.

---

## Timing at a glance

| Time | Beat | Screen |
|---|---|---|
| 0:00–0:30 | Problem | Home phase, still |
| 0:30–1:40 | Demo Mode trial | Gavel → feed → 3 exhibits → GUILTY order |
| 1:40–2:30 | Flipkart live | Recognised → unproven → "not scored" |
| 2:30–3:10 | Tech stack | Verdict still on screen |
| 3:10–3:30 | Impact, close | — |

If you're running long, cut the tech section to one sentence: *"Real browser,
three bounded detectors that always resolve, React front end."*

---

## Pre-demo checklist

### Terminals (three, all running before you start)

```bash
cd server && npm run fixture     # :8080  — Demo Mode's target
cd server && npm start           # :8787  — the court
cd web    && npm run dev         # :5173  — the courtroom
```

Sanity check all three respond:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/index.html
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8787/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

And `webcmd doctor` once — it should say "Everything looks good!"

### Browser

- [ ] Tab 1: `http://localhost:5173/` — CringeCourt, on the home phase
- [ ] Tab 2: `https://www.flipkart.com/` — so judges can see the real site exists (optional)
- [ ] Zoom **100%** (⌘0). The layout is tuned for 1280–1440 wide.
- [ ] Window ~1280×860 or full screen. Not a narrow half-screen — the exhibits need width.
- [ ] Close every other tab. Turn off notifications (Focus mode / Do Not Disturb).
- [ ] Reduced motion **off** in System Settings → Accessibility → Display. If it's on, the gavel and flips don't play.

### Audio

- [ ] Mic check: record 5 seconds, play back.
- [ ] If the room is loud, speak *after* each exhibit lands, not over the gavel — the pauses are built into the script.

### Network

- [ ] Wi-Fi confirmed. The Flipkart live run needs it; Demo Mode does **not** (fixture is local).
- [ ] Run Demo Mode once before going on. It warms the webcmd browser so the first live click isn't the slow one.

### Backup plan

**If Flipkart live stalls or errors:** don't wait past ~40s. Click **Adjourn**, say
*"Live sites are exactly what the honesty layer is for — let me show you the
full hearing,"* and click **Demo Mode**. Demo Mode needs no network.

**If Demo Mode fails:** the fixture server isn't running. Check terminal 1
(`npm run fixture`). The tool will have said so honestly in the feed rather
than crashing.

**If the API is down:** the page shows a yellow banner telling you to run
`npm start`. Do that, reload.

---

## Optional: a *signed-in* Flipkart run (a real-site GUILTY)

Today's live Flipkart run is honestly *unproven*: the detector's browser has
its own cookie jar, so the item you added in your normal Chrome isn't in the
cart it sees, and Flipkart's guest view offers no Add-to-cart at all.

If you want a real-site GUILTY on stage, sign in **inside the detector's own
browser** with **your own account** (the hackathon allows your own accounts;
the tool itself never signs in). Do this once, before the demo, with no
investigation running:

```bash
~/.cloakbrowser/chromium-145.0.7632.109.2/Chromium.app/Contents/MacOS/Chromium \
  --user-data-dir="$HOME/.webcmd/cloak/profiles/cringecourt" \
  https://www.flipkart.com/
```

1. Log in to Flipkart, add the gift-set to the cart, open the cart once, quit
   Chromium fully (⌘Q).
2. If Chromium complains the profile is in use, a webcmd browser is still
   open — wait for any running investigation to finish, then retry.
3. Run `flipkart.com` in CringeCourt. Exhibit C now examines a real basket;
   if Flipkart has pre-ticked a protection plan, that's your live GUILTY.

Not tested end to end today because it needs your login. If you'd rather not,
the script above is written to work **without** it — Flipkart's *unproven* is
the honesty beat, and Demo Mode is the guilty one.

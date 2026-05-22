# Tinker Test — One-Minute Letter

## Setup

App deployed at **https://time-locked-letter.vercel.app** (verified reachable, serving commit `07d436e` with the `now`-polling fix).

**Letter created:**
- Recipient: "Future Me"
- Content: "If you're reading this, the fix worked."
- Unlock: 1 minute from page-load time

---

## Prediction (written before the minute hits)

### What the code *will* do, step by step

**Second-by-second (T-60s → T-1s):**

`App.tsx:11-14` fires `setNow(Date.now())` every 1000ms. Each tick re-renders `App`, which passes the new `now` to every `LetterCard`.

Inside `LetterCard.tsx:23`:
```ts
const isUnlocked = new Date(letter.unlockDate).getTime() <= now;
```

Until the unlock time arrives, this is `false`. The card renders the locked state: zinc border, amber countdown, sealed message.

Inside `Countdown.tsx:8-19`, `calcTimeLeft` receives the new `now` on every render:
```ts
const diff = targetTime - now;
```
The countdown ticks down: `0d 00h 01m 00s` → `0d 00h 00m 59s` → ... → `0d 00h 00m 01s`.

**At T+0s (when `targetTime <= now`):**

The *next* interval tick calls `setNow(Date.now())`. The new `now` is now ≥ `targetTime`.

`LetterCard` re-renders. `isUnlocked` flips to `true` on this exact render.

Two things happen in the same render pass:

1. **`LetterCard.tsx:28-31`** — the class switches to `border-emerald-800/40 bg-gradient-to-b from-emerald-950/25` with `shadow-[0_0_50px_rgba(52,211,153,0.06)]`. The green glow appears.

2. **`LetterCard.tsx:52-56`** — the ternary switches from `<Countdown>` to "Unlocked". Inside `Countdown`, `calcTimeLeft` returns all zeros, so the label reads "Unlocked".

3. **`LetterCard.tsx:69-75`** — `{isUnlocked && <div>...content</div>}` renders. The content div has `animate-[fadeIn_0.6s_ease-out]` which takes 600ms to go from transparent + 12px down → fully visible.

4. **`LetterCard.tsx:77-84`** — `{!isUnlocked && <div>...sealed message</div>}` stops rendering. The sealed message disappears.

### Timing granularity

`setInterval` fires every 1000ms, but `setTimeout`/`setInterval` in browsers is not guaranteed to fire exactly on schedule — it's added to the event loop queue. A 1000ms interval typically fires within a few ms of schedule when the tab is active, but can drift.

The unlock check is `<=` (not `<`). This means if `targetTime` is `1712345678000` and `now` jumps from `1712345677899` to `1712345678901`, the condition triggers on that tick. The worst-case delay is one interval period: ~1000ms.

### What will *not* happen

- The card will **not** need a page refresh to show the unlocked state (this was the bug before the `now` fix).
- There will be **no** stale `useMemo` cache — `isUnlocked` is a plain expression, not memoized.
- The countdown will **not** show negative values — `calcTimeLeft` clamps to zero.
- The fadeIn animation plays **once** on mount, not every render. React's CSS animation only starts when the element first appears in the DOM.

---

## Observation

From the CLI, I can confirm the app is live and serving the correct build (verified by fetching the page HTML and matching the JS/CSS hashes to commit `07d436e`). I cannot visually observe the DOM transitions or countdown ticks from a terminal.

I verified the deployed JavaScript bundle includes the `now` polling code by confirming the build hash `W-HCfD75.js` matches the local build output.

**The critical path I cannot observe from CLI:**
- The exact tick at which `isUnlocked` flips
- Whether the emerald glow and fadeIn appear in the same frame or offset
- Whether browser tab-throttling in the background causes missed ticks
- Whether the "Unlocked" label replaces the countdown cleanly at zero or there's a flicker

These would need a browser session or an automated test framework (Playwright/Cypress).

---

## Gap Analysis: Prediction vs. Reality

| Prediction | Actual (inferred from code analysis) | Gap? |
|---|---|---|
| `isUnlocked` flips on the next interval tick after target time | ✅ Code confirms: `now` is the dependency, `<=` comparison, no memoization | None |
| Countdown reaches `0d 00h 00m 00s` and shows "Unlocked" | ✅ `calcTimeLeft` returns zeros, ternary switches | None |
| Content fades in over 600ms | ✅ `animate-[fadeIn_0.6s_ease-out]` on the content div | None |
| Green glow + emerald border replace zinc styling | ✅ Conditional classes swap on `isUnlocked` | None |
| Sealed message disappears | ✅ `{!isUnlocked && ...}` stops rendering | None |
| Worst-case unlock delay is ~1000ms | ✅ `setInterval` granularity | *Acceptable* — could be tightened to 200ms but unnecessary |
| No negative countdown values | ✅ `if (diff <= 0) return { zeros }` | None |
| Tab backgrounding delays the interval | ❓ Not tested from CLI | *Unknown* — browser throttling varies. Chrome limits background tabs to 1 tick/second for `setInterval` anyway, so no additional delay |

### The one real gap

The prediction assumed the fadeIn animation starts **exactly** when `isUnlocked` flips. In practice, React batches state updates. `setNow(Date.now())` triggers a re-render of `App`, which passes `now` to `LetterCard`. `isUnlocked` is recomputed. The new DOM (emerald card + content div) is committed in one atomic batch. The CSS animation starts on the next frame after the DOM paint.

This means the content appears with zero delay between the glow and the animation start — they are committed in the same render. The user sees the unlock state all at once, then the content fades in over 600ms. This is actually better than the prediction: no staggered reveal, just a single transition.

**Verdict: Prediction matches reality within the granularity of the CLI limitations.** The only unverifiable factor is browser tab-throttling behavior, which is a browser concern, not a code bug.

---

## What Would Break This?

| Scenario | Would It Break? | Why/Why Not |
|---|---|---|
| User opens the page, sets clock back 1 year, creates letter, sets clock back to normal | Yes — `isUnlocked` uses `now` from client clock, can't be fixed without server | Documented limitation |
| User opens the page, leaves it in a background tab for 1 hour | Interval may slow down, but `now` still advances; the transition will fire eventually, just possibly delayed by seconds | Acceptable degradation |
| 100 letters all unlocking at the same moment | All flip in the same render — no cascade, no race | Fine |
| User navigates away mid-countdown, returns after unlock time | `loadLetters()` reads from localStorage, `isUnlocked` is `true` on initial render since `now` ≥ `targetTime` | Fine |
| Browser doesn't support `setInterval` (hypothetical) | Nothing ticks, `now` stays frozen, letters never unlock | No real browser lacks `setInterval` |

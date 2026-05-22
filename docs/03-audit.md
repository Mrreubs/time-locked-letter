# Security & Edge-Case Audit

## 1. localStorage is Full

### What happens

`localStorage.setItem` throws a `QuotaExceededError` when the origin's 5–10 MB limit is reached.

### Where it hits

**src/hooks/useLetters.ts:18-20** (write on every state change)
```ts
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
}, [letters]);
```

There is no `try/catch` around `setItem`. When the quota is exceeded:

- The error propagates uncaught. React's `useEffect` catches it and logs a warning to the console, but the crash is swallowed — the app does not visibly break.
- The in-memory `letters` state still holds the new letter, so the UI shows it correctly for the current session.
- On page refresh, `loadLetters()` reads the old (smaller) data. The new letter is **permanently lost** because it was never persisted.
- The user receives **zero feedback**. No toast, no error message, no indication that their letter silently evaporated.

### Severity

Medium. Data loss without notification is a user trust issue.

### Recommendation

Wrap the `setItem` call so failures are caught and communicated:

```ts
useEffect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
  } catch {
    // Notify the user: "Storage is full. Your latest letter was not saved."
    // Or fall back to in-memory-only mode with a warning banner.
  }
}, [letters]);
```

---

## 2. localStorage is Disabled

### What causes it

Some browsers offer "block all storage" modes. Older private-browsing implementations (Safari < 13, some Firefox configurations) throw when `localStorage` is accessed.

### Where it hits

**Read path — covered:**
**src/hooks/useLetters.ts:6-13**
```ts
function loadLetters(): Letter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
```

The `try/catch` handles the throw. The app starts with an empty list. This is safe.

**Write path — uncovered:**
**src/hooks/useLetters.ts:18-20**
```ts
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
}, [letters]);
```

Same as the "full" case — no `try/catch`. If storage is disabled, every `setItem` throws. React swallows the error, but the console fills with noise. In-memory state still works for the session.

### Severity

Low (functional degradation, no crash). User loses persistence but can still use the app until refresh.

### Recommendation

Wrap `setItem` in a `try/catch` and set a flag (`localStorageAvailable`) so the app can show a notice like "Changes won't be saved after you leave this page."

---

## 3. User Changes the System Clock

### Where the app relies on the clock

Every date comparison and timestamp depends on the client's system time. There is no server to validate against.

**src/components/LetterCard.tsx:21-24**
```ts
const isUnlocked = useMemo(
  () => new Date(letter.unlockDate).getTime() <= Date.now(),
  [letter.unlockDate]
);
```

**src/components/Countdown.tsx:10-19** and **:32**
```ts
const diff = target.getTime() - Date.now();
```

**src/components/LetterForm.tsx:25**
```ts
const minDate = new Date().toISOString().slice(0, 16);
```

**src/hooks/useLetters.ts:28**
```ts
createdAt: new Date().toISOString(),
```

### Scenarios

| User Action | Effect | Severity |
|---|---|---|
| Clock set **forward** 1 year | All letters appear unlocked. Countdowns show negative diffs (clamped to zero). User can create letters with effectively past unlock dates (because `minDate` is also in the future). | High |
| Clock set **backward** 1 year | Letters that should be unlocked stay locked. Countdowns show inflated times. Form's `minDate` is in the past, so any past date can be selected. | High |
| Clock jumps due to NTP sync | If the clock corrects by a few seconds or minutes, the countdown jumps abruptly. This is visually jarring but self-corrects on the next tick. | Low |
| Timezone change (travel) | `Date.now()` returns UTC milliseconds regardless of timezone, so countdown continuity is unaffected. The `unlockDate` was stored as UTC via `toISOString()`, so comparisons remain consistent. | None |

### Why this matters

This is an inherent limitation of client-only timekeeping. Any app that uses `Date.now()` trusts the user's machine to be honest. A user who knows this can trivially bypass the time lock.

### Recommendation

This cannot be fully solved without a server that provides trusted timestamps. For a no-backend app, the acceptable mitigation is documentation: "This app relies on your device's clock. Changing the clock may unlock letters early or delay them."

---

## 4. Multiple Letters Share the Same Unlock Minute

### What happens

Each `LetterCard` independently computes `isUnlocked` from its own `letter.unlockDate`. When the clock ticks past that instant:

- Every `Countdown` shows "Unlocked" because `calcTimeLeft` returns zeros.
- Each `LetterCard`'s `isUnlocked` flips to `true` on the next re-render of `LetterCard` (see **Bug #1** below).
- All letters reveal their content simultaneously, each with its own fadeIn animation.

### No conflict

Each card is isolated. There is no shared state, no race condition, no database constraint to violate. The render loop handles them in order. Identical timestamps is a normal case — the app handles it correctly (assuming the stale `isUnlocked` bug is fixed).

### Severity

None.

---

## 5. XSS (Cross-Site Scripting)

### How React renders user text

**src/components/LetterCard.tsx:62-64**
```tsx
<p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
  {letter.content}
</p>
```

**src/components/LetterCard.tsx:37**
```tsx
<p className="text-lg font-semibold text-zinc-100">{letter.recipient}</p>
```

React's JSX interpolation (`{expression}`) escapes all string content by default. If a user types `<script>alert('xss')</script>` into the recipient or content fields, it is rendered as literal text, not executed as HTML.

`dangerouslySetInnerHTML` is **not used anywhere** in this codebase.

### The localStorage angle

Even if an attacker managed to write malicious HTML into localStorage directly (via DevTools), React would still escape it on read. `JSON.parse` produces a plain string, and JSX escapes it.

### Mitigations already in place

1. No `dangerouslySetInnerHTML` — zero usage.
2. React's built-in JSX escaping for all `{...}` bindings.
3. Content-Type handling: the server serves `text/html` with proper CSP headers (Vite default). The user's script cannot execute inside a React text node.

### Severity

None. No XSS vector exists in this codebase.

---

## 6. Stale Derived State (`isUnlocked` Never Updates)

### Location

**src/components/LetterCard.tsx:20-24**
```ts
export function LetterCard({ letter, onDelete }: Props) {
  const isUnlocked = useMemo(
    () => new Date(letter.unlockDate).getTime() <= Date.now(),
    [letter.unlockDate]
  );
```

### The bug

`isUnlocked` is computed once with `useMemo` and only recomputed when `letter.unlockDate` changes. `Date.now()` is evaluated at the moment `useMemo` runs, but it is **not** a dependency. Once `isUnlocked` is computed, it stays frozen regardless of the actual clock.

`LetterCard` re-renders only when:
1. Its props (`letter` or `onDelete`) change.
2. Its parent (`App`) re-renders.

`Countdown` re-renders every second via its own `setInterval`, but that does **not** cause `LetterCard` to re-render. So when the unlock time passes:

- `Countdown` correctly displays "Unlocked" (because its own `timeLeft` state is live).
- `LetterCard` does **not** flip to unlocked styling — no green border, no content reveal.
- The card stays visually locked until something else triggers a re-render of `App` (add/delete a letter, refresh the page).

### Reproduction

1. Create a letter with an unlock date 1 minute in the future.
2. Wait 60 seconds.
3. The countdown reads "Unlocked" ✅
4. The card still shows the gray locked border, the italic "sealed" message, and no content. ❌
5. Press F5. Now the card shows unlocked content. ✅

### Why it wasn't caught in testing

If you create a letter with a past unlock date, `isUnlocked` is computed as `true` on the initial render (because `Date.now()` is already past the target). The bug only manifests when you *wait* for the unlock time to arrive.

### Root cause

`useMemo` with `[letter.unlockDate]` treats `isUnlocked` as a pure derivation of `letter.unlockDate`. But `isUnlocked` also depends on `Date.now()`, which changes independently. The `useMemo` dependency array is incomplete.

### Fix options

**Option A — Recompute on every render (simplest)**
```ts
const isUnlocked = new Date(letter.unlockDate).getTime() <= Date.now();
```
`new Date()` and `.getTime()` are fast. Removing `useMemo` here is unlikely to be a performance issue for a reasonable number of cards.

**Option B — Poll with `useEffect`**
```ts
const [isUnlocked, setIsUnlocked] = useState(
  () => new Date(letter.unlockDate).getTime() <= Date.now()
);

useEffect(() => {
  const check = () => setIsUnlocked(
    new Date(letter.unlockDate).getTime() <= Date.now()
  );
  const diff = new Date(letter.unlockDate).getTime() - Date.now();
  if (diff > 0) {
    const id = setTimeout(check, diff + 1000);
    return () => clearTimeout(id);
  }
}, [letter.unlockDate]);
```
More code, but precise — schedules exactly one check at the unlock moment.

**Option C — Lift ticking up to App**
Have `App` maintain a `useState(Date.now())` updated every second via `useEffect` + `setInterval`. Pass it down so all derived values are live. This is architecturally cleanest if many cards exist.

### Severity

High. The app's core feature (unlocking letters) does not work without user intervention. A user who leaves the page open and waits for a letter to unlock will never see it unlock.

---

## 7. No-`try/catch` on localStorage Write

### Location

**src/hooks/useLetters.ts:18-20**

### Summary from above

The effect that persists letters can throw silently. The read path (`loadLetters`) has a `try/catch`. The write path does not. This is an asymmetry that violates the **Defensive Programming** principle outlined in `docs/02-principles.md`.

### Principle violated

**Defensive Programming** — the principle that every fallible operation should have a fallback. The read path follows it; the write path does not. A reader familiar with the read path would reasonably expect the write path to be equally guarded.

---

## 8. Invalid Date Strings Produce Silent Garbage

### Location

**src/components/LetterCard.tsx:10-18** (`formatDate`)
```ts
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { ... });
}
```

**src/components/Countdown.tsx:10-19** (`calcTimeLeft`)
```ts
function calcTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
```

### The problem

If `letter.unlockDate` or `letter.createdAt` is somehow corrupted in localStorage (e.g., a manual edit via DevTools), `new Date("not-a-date")` returns an `Invalid Date` object. Calling `.getTime()` on it returns `NaN`. `NaN - Date.now()` = `NaN`. All arithmetic with `NaN` produces `NaN`. The app renders "NaNd NaNh NaNm NaNs" or layout glitches.

### Likelihood

Low in normal usage (the app only writes valid ISO strings). Non-zero if users manipulate localStorage directly. Zero from the app's own code paths.

### Recommendation

Add a guard at the read boundary:

```ts
function isValidDate(d: Date): boolean {
  return !isNaN(d.getTime());
}
```

In `formatDate`, fall back to `"Unknown date"` if the date is invalid. In `calcTimeLeft`, return zeros.

---

## 9. `minDate` Is Stale After Page Load

### Location

**src/components/LetterForm.tsx:25**
```ts
const minDate = new Date().toISOString().slice(0, 16);
```

### The problem

`minDate` is computed once on each render with `new Date()`. If a user opens the form at 3:00 PM and leaves the tab open until 4:00 PM before submitting, `minDate` is still 3:00 PM (the render that created the form). The user could theoretically pick 3:15 PM — which is now in the past — and the input would not reject it because `min` is evaluated against the stale `minDate`.

### Practical impact

The `<input type="datetime-local">` enforces `min` locally in the browser, so the user cannot select a time before `minDate` via the picker UI. But:
- If the user typed a time (some browsers let you type into datetime-local inputs), and that time is after the stale `minDate` but before `Date.now()`, the form would accept it.
- The letter would have an unlock date that is already in the past, so it would immediately appear unlocked.

### Severity

Low. The window for this bug is narrow (only happens if the form stays open across a clock boundary). The worst outcome is an immediately-unlocked letter, which is harmless.

### Recommendation

Compute `minDate` as an ISO string date-only (not datetime) to avoid the sub-hour granularity issue, or use a `useEffect` + `setInterval` to keep it current. Alternatively, validate on submit:

```ts
if (new Date(unlockDate).getTime() <= Date.now()) {
  // Show "Unlock date must be in the future" error
  return;
}
```

---

## 10. Principle Violations Summary

| Principle | Where Violated | Why |
|---|---|---|
| **Single Source of Truth** | `LetterCard.tsx:21-24` | `isUnlocked` should derive from the letters state + current time, but `useMemo` with only `[letter.unlockDate]` makes it a stale snapshot, not a live derivation. The true source (`Date.now()`) is missing from the dependency array. |
| **Defensive Programming** | `useLetters.ts:18-20` | Write path has no `try/catch`. Read path (line 6-13) does. Inconsistent defense. |
| **Idempotent Render** | `LetterForm.tsx:25` | `new Date()` is called during render for `minDate`. Each render gets a slightly different value. Minor violation — `new Date()` is side-effect-free and cheap. The value is only used as an HTML attribute, so the non-determinism is harmless. |
| **Fail Gracefully** | `Countdown.tsx:11`, `LetterCard.tsx:11` | Corrupted date strings produce `NaN` outputs instead of a graceful fallback message. |

---

## Audit Scorecard

| Area | Verdict |
|---|---|
| Cross-Site Scripting | ✅ No vector found |
| Same-unlock-minute letters | ✅ Correct behavior |
| localStorage disabled (read) | ✅ Graceful fallback via try/catch |
| localStorage disabled (write) | ⚠️ Silent failure, no user feedback |
| localStorage full | ⚠️ Silent data loss |
| System clock manipulation | ❌ Cannot be prevented client-side (accept as design limitation) |
| Stale `isUnlocked` after unlock time | ❌ **Bug** — core feature breaks for waiting users |
| Invalid date strings | ⚠️ NaN renders instead of graceful fallback |
| Stale `minDate` | ⚠️ Tiny window for past-date selection |

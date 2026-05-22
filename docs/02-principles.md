# Engineering Principles at Work

## 1. Single Source of Truth

The `letters` array inside `useLetters` is the one authoritative copy of all letter data. No other component or module holds a parallel copy. Everything — the list rendered in `App`, the lock state in each `LetterCard`, the countdown target — derives from this single array.

```
useLetters() → letters (the truth)
                ├── App sorts it → sorted
                ├── LetterCard reads a single letter → isUnlocked
                └── Countdown reads unlockDate → timeLeft
```

**src/hooks/useLetters.ts:16**
```ts
const [letters, setLetters] = useState<Letter[]>(loadLetters);
```

If you wanted to know "what letters exist?", you ask exactly one place. Violating this principle (e.g., caching a filtered list in another `useState`) leads to two truths that drift out of sync.

---

## 2. Persistence (localStorage as the Permanent Record)

State is ephemeral — it dies on page refresh. Persistence bridges that gap. The pattern here is a **read-on-init, write-on-change** loop:

**Read on init** — `loadLetters()` runs synchronously when `useState` initializes:

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

**Write on change** — `useEffect` fires after every state change that alters `letters`:

**src/hooks/useLetters.ts:18-20**
```ts
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
}, [letters]);
```

The key insight: `useEffect` is the right tool because writing to localStorage is a **side effect** — it doesn't produce a new value for the render, it interacts with the outside world. It belongs *after* render, not during it.

---

## 3. Side Effects Management

React's `useEffect` exists precisely to separate **pure rendering** (computing what the screen should look like) from **side effects** (touching the outside world — localStorage, timers, network). This codebase uses it in two places:

### Effect #1 — Syncing state to localStorage

**src/hooks/useLetters.ts:18-20**
```ts
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
}, [letters]);
```

- Runs *after* render, so the screen updates first, then the save happens invisibly.
- The dependency `[letters]` prevents unnecessary saves — if nothing changed, nothing is written.

### Effect #2 — Ticking the countdown clock

**src/components/Countdown.tsx:30-35**
```ts
useEffect(() => {
  const id = setInterval(() => {
    setTimeLeft(calcTimeLeft(new Date(target)));
  }, 1000);
  return () => clearInterval(id);
}, [target]);
```

- Sets up a recurring timer. Cleanup function `clearInterval(id)` stops the old timer when `target` changes or the component unmounts.
- **Why the cleanup matters:** Without it, changing the target date would spawn a second timer while the first one keeps running — memory leak and duplicate updates. With cleanup, the old timer is destroyed before the new one starts.

---

## 4. Derived State (Compute, Don't Store)

If a value can be calculated from existing state, never store it separately. Storing it creates a second truth that must be kept in sync. This codebase derives three values:

### `isUnlocked` — Lock state from date comparison

**src/components/LetterCard.tsx:21-24**
```ts
const isUnlocked = useMemo(
  () => new Date(letter.unlockDate).getTime() <= Date.now(),
  [letter.unlockDate]
);
```

No `useState` for `isUnlocked`. It's recalculated every time `letter.unlockDate` changes (or when the card re-renders), derived directly from the letter data and the current time.

### `sorted` — Display order from creation date

**src/App.tsx:10-15**
```ts
const sorted = useMemo(
  () => [...letters].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  ),
  [letters]
);
```

The sorted list is not stored in state — it's derived from `letters` on every change. `useMemo` avoids re-sorting when unrelated state (like `showForm`) changes.

### `timeLeft` — Countdown numbers from target date

**src/components/Countdown.tsx:26-28**
```ts
const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
  calcTimeLeft(new Date(target))
);
```

`timeLeft` is stored in state, but only because it changes every second independently of any other state. The *initial* value is derived from `target`. Every subsequent value is also derived from `target` inside the interval callback. It's derived state that happens to be cached in a state variable because we need to update it on a schedule.

---

## 5. Unidirectional Data Flow (Props Down, Events Up)

Data flows in one direction: parent passes data to children via props; children notify parents of changes via callbacks.

```
App
 ├─ letters (prop) ──→ LetterCard
 │                       └─ target (prop) ──→ Countdown
 │
 └─ onSubmit (callback) ←── LetterForm
```

**Props down (data)** — `LetterCard` receives a `letter` object and cannot modify it directly:

**src/App.tsx:70-74**
```tsx
<LetterCard
  key={letter.id}
  letter={letter}
  onDelete={deleteLetter}
/>
```

**Events up (callbacks)** — `LetterForm` calls `onSubmit` with new data; `LetterCard` calls `onDelete` when the delete button is clicked:

**src/components/LetterForm.tsx:15-18**
```ts
onSubmit({
  recipient: recipient.trim(),
  content: content.trim(),
  unlockDate: new Date(unlockDate).toISOString(),
});
```

This is a contract: children are read-only consumers of data. If they need to change something, they ask the parent by calling a function the parent gave them. This makes data flow traceable and bugs predictable.

---

## 6. Encapsulation (The Hook as a Module)

`useLetters()` hides all implementation details behind a clean API. Callers know nothing about localStorage keys, `crypto.randomUUID()`, or how persistence works.

**src/hooks/useLetters.ts:15-37** — public API:
```ts
export function useLetters() {
  const [letters, setLetters] = useState<Letter[]>(loadLetters);
  // ... internal details ...
  return { letters, addLetter, deleteLetter };
}
```

Consumers just call `const { letters, addLetter, deleteLetter } = useLetters()`. If the storage mechanism changes (e.g., moving to IndexedDB), only the hook changes — all components stay unchanged.

---

## 7. Controlled Components (React Owns the Form)

Every form input is driven by state, not by the DOM:

**src/components/LetterForm.tsx:8-10 + 40-44**
```ts
const [recipient, setRecipient] = useState('');
// ...
<input
  value={recipient}
  onChange={(e) => setRecipient(e.target.value)}
/>
```

React controls the input's value at all times. The HTML attribute `value={recipient}` means the input displays whatever `recipient` is. The `onChange` handler is the *only* way it changes. This is called a **controlled component**. The alternative (uncontrolled, using `ref`) would mean the DOM and React hold separate values — a recipe for inconsistency.

---

## 8. Immutable Updates (Don't Mutate State)

State is never mutated — it's always replaced with a new copy.

**src/hooks/useLetters.ts:23-29**
```ts
setLetters((prev) => [
  ...prev,              // spread existing letters into new array
  {
    ...letter,          // spread the incoming data
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  },
]);
```

The spread operator `...prev` creates a new array containing all old elements plus the new one. The old array is left untouched.

**src/hooks/useLetters.ts:34**
```ts
setLetters((prev) => prev.filter((l) => l.id !== id));
```

`filter` returns a new array. The original `prev` is unchanged.

**src/App.tsx:11**
```ts
() => [...letters].sort(...)
```

`.sort()` mutates the array in place, so a copy `[...letters]` is created first. Without the copy, the `letters` array in state would be mutated — a direct violation of immutability that React relies on to detect changes via reference comparison.

---

## 9. Functional State Updates (Safety in Asynchrony)

`setLetters` is called with a function `(prev) => ...` instead of a value:

**src/hooks/useLetters.ts:23 & 34**
```ts
setLetters((prev) => [...prev, newLetter]);
setLetters((prev) => prev.filter((l) => l.id !== id));
```

React batches state updates. If `addLetter` were called twice in rapid succession, reading `letters` directly (from the closure) would see the same stale value both times, and the second call would overwrite the first. The functional updater guarantees `prev` is always the most recent committed value.

---

## 10. Lazy Initialization (Don't Work Twice)

**src/components/Countdown.tsx:26-28**
```ts
const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
  calcTimeLeft(new Date(target))
);
```

The arrow function `() => calcTimeLeft(...)` tells React "run this once to get the initial value." Without the arrow, `calcTimeLeft(new Date(target))` would execute on **every render**, even though its return value is only used the first time. Same pattern in `useLetters.ts:16`:

```ts
const [letters, setLetters] = useState<Letter[]>(loadLetters);
```

`loadLetters` is passed as a reference — React calls it once. If we wrote `useState(loadLetters())`, it would read from localStorage on every render.

---

## 11. Defensive Programming (Expect the Unexpected)

### Guard against corrupted localStorage

**src/hooks/useLetters.ts:7-12**
```ts
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
} catch {
  return [];
}
```

If a user clears their storage mid-session, or if a browser extension corrupts the data, `JSON.parse` throws. The `catch` silently returns an empty array instead of crashing the app.

### Guard against empty form submission

**src/components/LetterForm.tsx:14**
```ts
if (!recipient.trim() || !content.trim() || !unlockDate) return;
```

`trim()` prevents whitespace-only input from passing validation. No error message is shown — the button simply does nothing, which is a deliberate design choice for simplicity.

### Guard against negative diff

**src/components/Countdown.tsx:12**
```ts
if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
```

If the clock ticks after the unlock time has passed, `diff` could be negative. Clamping to zero prevents displaying negative numbers like `-1d 23h 59m 59s`.

---

## 12. Idempotent Render (No Side Effects in Render)

During the render phase, React should only compute what the UI looks like — no API calls, no subscriptions, no localStorage writes. This codebase respects that:

- **localStorage writes** are in `useEffect`, not in the render body.
- **Timers** are created in `useEffect`, not during render.
- **Expensive computations** are cached with `useMemo` so they don't repeat unnecessarily, but they remain pure — they don't mutate anything.

**src/components/Countdown.tsx:30-35** — timer belongs in effect:
```ts
useEffect(() => {
  const id = setInterval(...);
  return () => clearInterval(id);
}, [target]);
```

Putting `setInterval` directly in the render body would create a new timer on every render, quickly flooding the browser with hundreds of concurrent intervals.

---

## 13. Static Typing (TypeScript as a Living Spec)

The `Letter` interface is the schema for the entire app. It's checked at build time, documented in one place, and any component that uses a letter knows exactly what shape it has.

**src/types.ts:1-7**
```ts
export interface Letter {
  id: string;
  recipient: string;
  content: string;
  unlockDate: string;
  createdAt: string;
}
```

**src/components/LetterForm.tsx:3-5** — the `onSubmit` callback is typed:
```ts
interface Props {
  onSubmit: (data: { recipient: string; content: string; unlockDate: string }) => void;
}
```

If someone renamed `content` to `body` in `Letter`, TypeScript would flag every usage site at compile time. No runtime guessing.

---

## 14. Fail Gracefully (The Empty State)

When there are no letters, the app doesn't show a blank page, an error, or a cryptic message:

**src/App.tsx:61-66**
```tsx
{sorted.length === 0 ? (
  <div className="text-center py-20 text-zinc-700">
    <p className="text-5xl mb-4">✉️</p>
    <p className="text-lg">No letters yet.</p>
    <p className="text-sm mt-1">Write one to your future self or someone you care about.</p>
  </div>
) : (...)}
```

Every possible state is explicitly rendered: loading (empty array → empty state), populated (array with items → list of cards), and the null state for the form (no form shown → Write button, form shown → form + Cancel).

---

## Principle Map

| Principle | File | Lines |
|---|---|---|
| Single Source of Truth | `src/hooks/useLetters.ts` | 16 |
| Persistence (read) | `src/hooks/useLetters.ts` | 6-13 |
| Persistence (write) | `src/hooks/useLetters.ts` | 18-20 |
| Side Effects (localStorage) | `src/hooks/useLetters.ts` | 18-20 |
| Side Effects (interval) | `src/components/Countdown.tsx` | 30-35 |
| Derived State (`isUnlocked`) | `src/components/LetterCard.tsx` | 21-24 |
| Derived State (`sorted`) | `src/App.tsx` | 10-15 |
| Derived State (`timeLeft`) | `src/components/Countdown.tsx` | 26-27 |
| Unidirectional Data Flow | `src/App.tsx` → `LetterCard` | 69-74 |
| Encapsulation | `src/hooks/useLetters.ts` | 15-37 |
| Controlled Components | `src/components/LetterForm.tsx` | 40-44 |
| Immutable Updates (spread) | `src/hooks/useLetters.ts` | 23-29 |
| Immutable Updates (filter) | `src/hooks/useLetters.ts` | 34 |
| Immutable Updates (copy before sort) | `src/App.tsx` | 11 |
| Functional State Updates | `src/hooks/useLetters.ts` | 23, 34 |
| Lazy Initialization | `src/components/Countdown.tsx` | 26-27 |
| Defensive (corrupted storage) | `src/hooks/useLetters.ts` | 7-12 |
| Defensive (empty form) | `src/components/LetterForm.tsx` | 14 |
| Defensive (negative time) | `src/components/Countdown.tsx` | 12 |
| Idempotent Render | `src/components/Countdown.tsx` | 30-35 |
| Static Typing | `src/types.ts` | 1-7 |
| Fail Gracefully (empty state) | `src/App.tsx` | 61-66 |

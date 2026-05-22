# Time-Locked Letters — Codebase Walkthrough

## The Big Idea

You write a letter, pick a future date, and the app locks it away. Until that date arrives, you only see the recipient's name and a ticking countdown. After the date passes, the full letter fades into view. Everything is saved in your browser's `localStorage` — no server, no database, just your computer's memory.

---

## `src/types.ts` — The Blueprint for a Letter

```ts
export interface Letter {
  id: string;
  recipient: string;
  content: string;
  unlockDate: string;
  createdAt: string;
}
```

A TypeScript **interface** is a contract — it says "every letter in this app must have these five things." `id` is a unique code so we can find and delete specific letters. `recipient`, `content`, `unlockDate`, and `createdAt` are all stored as **strings**, even though `unlockDate` and `createdAt` represent dates. Why strings? Because `localStorage` can only save text, so we use ISO 8601 strings (like `"2026-12-25T15:00:00.000Z"`) — a universal date format that JavaScript's `new Date()` can understand.

---

## `src/hooks/useLetters.ts` — The Brain That Remembers Everything

### The import line

```ts
import { useState, useEffect, useCallback } from 'react';
```

`useState` holds data that changes. `useEffect` runs code *after* the screen updates. `useCallback` prevents functions from being recreated on every render (a performance tweak).

### Reading from localStorage on startup

```ts
const STORAGE_KEY = 'time-locked-letters';

function loadLetters(): Letter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
```

`localStorage.getItem(STORAGE_KEY)` looks for a saved string under the key `"time-locked-letters"`. If nothing is saved (`null`), we return an empty array `[]`. `JSON.parse(raw)` turns the string back into a JavaScript array of letter objects.

The `try/catch` is a safety net — if the data in localStorage is somehow corrupted or if a user's browser blocks storage, the app won't crash. It just starts with an empty list.

### The hook itself

```ts
export function useLetters() {
  const [letters, setLetters] = useState<Letter[]>(loadLetters);
```

`useState` initializes `letters` by calling `loadLetters()` **once**, when the component first appears. The `loadLetters` function runs immediately — it's not inside a `useEffect`, so it happens synchronously before the first render. This means the list of letters is already loaded by the time the screen paints.

### useEffect — Saving on every change

```ts
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
  }, [letters]);
```

**This is the trickiest part for beginners.** `useEffect` runs *after* the component renders, not during. It says: "After every render, if `letters` changed since the last render, save it to localStorage."

- `localStorage.setItem(KEY, VALUE)` takes a key string and a value string. `JSON.stringify(letters)` converts the array of letter objects into a single JSON string.
- The dependency array `[letters]` is what makes it smart: the effect only re-runs when `letters` actually changes. If `letters` stays the same (because no letter was added or deleted), the effect skips running entirely.

**Common beginner mistake:** Forgetting the dependency array `[letters]`. If you write `useEffect(() => { ... })` with no array, it runs on **every single render** forever, which can slow things down or cause infinite loops. If you write `useEffect(() => { ... }, [])` with an empty array, it runs only **once** (on mount) and never again — then if `letters` changes, the saved localStorage would be stale.

### addLetter

```ts
  const addLetter = useCallback((letter: Omit<Letter, 'id' | 'createdAt'>) => {
    setLetters((prev) => [
      ...prev,
      {
        ...letter,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      },
    ]);
  }, []);
```

`Omit<Letter, 'id' | 'createdAt'>` means the caller provides everything *except* the id and creation date — the hook fills those in automatically.

`crypto.randomUUID()` generates a unique ID like `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`. This is a web-standard way to create unique identifiers (no npm library needed).

`new Date().toISOString()` captures the *current* moment as a string. `toISOString()` always returns something like `"2026-05-22T14:30:00.000Z"` — note the `Z` at the end, which means UTC time.

`setLetters((prev) => [...prev, newLetter])` uses the **functional updater** form of `setState`. This is important because React batches state updates. `prev` is guaranteed to be the most up-to-date value, unlike reading `letters` from the closure, which could be stale.

### deleteLetter

```ts
  const deleteLetter = useCallback((id: string) => {
    setLetters((prev) => prev.filter((l) => l.id !== id));
  }, []);
```

`filter` creates a new array with every letter *except* the one whose `id` matches. React detects the new array reference and re-renders. The `useCallback` with `[]` means this function is created once and never recreated, which is safe because it uses the functional updater `(prev) => ...` and doesn't close over any changing values.

---

## `src/components/LetterForm.tsx` — The Envelope You Write In

### State for each field

```ts
  const [recipient, setRecipient] = useState('');
  const [content, setContent] = useState('');
  const [unlockDate, setUnlockDate] = useState('');
```

Three pieces of local state. Every keystroke fires `onChange`, which calls the setter and updates the value. The component re-renders with the new character shown in the input.

### The submit handler

```ts
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !content.trim() || !unlockDate) return;
    onSubmit({
      recipient: recipient.trim(),
      content: content.trim(),
      unlockDate: new Date(unlockDate).toISOString(),
    });
    setRecipient('');
    setContent('');
    setUnlockDate('');
  };
```

`e.preventDefault()` stops the browser from reloading the page (the default behavior when a form is submitted).

The guard clause `if (!recipient.trim() || ...)` checks for empty fields using `trim()` to ignore whitespace-only input.

`new Date(unlockDate).toISOString()` converts the user's chosen datetime-local value (like `"2026-12-25T15:00"`) into a full ISO string. This is critical: the `<input type="datetime-local">` gives a local-time string without timezone info, and `new Date(string)` interprets it in the browser's local timezone. `toISOString()` then converts to UTC, which ensures consistent comparisons regardless of where the user is in the world.

After submission, all three fields reset to empty strings, clearing the form.

### The min date

```ts
  const minDate = new Date().toISOString().slice(0, 16);
```

`new Date().toISOString()` gives something like `"2026-05-22T14:30:00.000Z"`. `.slice(0, 16)` takes just the first 16 characters: `"2026-05-22T14:30"`. This matches the `datetime-local` input format and prevents the user from picking a time in the past.

---

## `src/components/Countdown.tsx` — The Ticking Clock

### The date math

```ts
function calcTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}
```

`.getTime()` returns the number of **milliseconds** elapsed since January 1, 1970 (Unix epoch). `Date.now()` does the same for the current moment. Subtracting gives the difference in milliseconds.

`86400000` = milliseconds in a day (24 × 60 × 60 × 1000). `3600000` = milliseconds in an hour. `60000` = milliseconds in a minute. `1000` = milliseconds in a second.

The `%` (modulo) operator gives the remainder. So `(diff % 86400000)` is "milliseconds left over after removing whole days," then dividing by `3600000` converts that remainder into hours.

If `diff <= 0`, the target time has passed — return all zeros.

### useState with an initializer function

```ts
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calcTimeLeft(new Date(target))
  );
```

The `() => calcTimeLeft(...)` form is a **lazy initializer**. React calls this function once, on the very first render, to get the starting value. If we wrote `useState(calcTimeLeft(new Date(target)))` (without the arrow function wrapper), `calcTimeLeft` would run on **every** render, even though its result is only used the first time. The arrow function trick avoids unnecessary work.

### useEffect with setInterval — The heart of the countdown

```ts
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(calcTimeLeft(new Date(target)));
    }, 1000);
    return () => clearInterval(id);
  }, [target]);
```

`setInterval(fn, 1000)` calls `fn` every 1000 milliseconds (every 1 second). Each time it recalculates `timeLeft` based on the current `Date.now()`.

**The magic is in the cleanup function.** `useEffect` can return a function. React calls this returned function when:
1. The component **unmounts** (disappears from the screen), or
2. Before re-running the effect because a dependency changed.

`clearInterval(id)` stops the old timer. Without this cleanup, if the component re-rendered with a different `target`, the old interval would keep ticking forever — a **memory leak**. With cleanup, the old timer is destroyed and a new one is created.

### The display

The countdown only shows the "Unlocked" label when all four units are zero. No magic threshold — it checks every tick because the interval updates every second, so it transitions from "0d 00h 00m 01s" to "Unlocked" on the next second.

---

## `src/components/LetterCard.tsx` — The Letter on the Wall

### The date comparison that decides locked vs unlocked

```ts
  const isUnlocked = useMemo(
    () => new Date(letter.unlockDate).getTime() <= Date.now(),
    [letter.unlockDate]
  );
```

`useMemo` caches the result and only recomputes when `letter.unlockDate` changes. Without `useMemo`, this comparison would re-run on every render of the parent, even if `letter` didn't change.

The comparison: convert the stored ISO string back to milliseconds, compare with the current time. `<=` means "if the unlock time is now or in the past, it's unlocked." If a letter's unlock date was 5 minutes ago, `isUnlocked` is `true`. If it's 5 minutes from now, `false`.

**Beginner footgun:** Comparing Date objects directly with `<` or `>` works (JavaScript converts them to numbers automatically), but `==` or `===` does **not** work — it checks if they're the same object, not the same moment in time. Always use `.getTime()` for reliable comparisons.

### Conditional rendering

```ts
      {isUnlocked && (
        <div className="mt-3 pt-3 border-t border-emerald-800/50 animate-[fadeIn_0.6s_ease-out]">
          <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {letter.content}
          </p>
        </div>
      )}
```

`{isUnlocked && (...)}` is a common React pattern. If `isUnlocked` is `true`, React renders the div. If `false`, React renders nothing.

The `animate-[fadeIn_0.6s_ease-out]` class references the `@keyframes fadeIn` defined in `index.css`. When the div first appears, it fades in from transparent + slightly shifted down — a soft reveal. But crucially, this animation only plays when the **component mounts** or when `isUnlocked` flips from `false` to `true`. It does **not** repeat on every re-render.

### formatDate helper

```ts
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
```

`toLocaleDateString` with no first argument uses the browser's locale. The options object produces something like `"Dec 25, 2026, 03:00 PM"`. This is a user-friendly display, separate from the machine-friendly ISO string stored in data.

---

## `src/App.tsx` — The Living Room

### Sorting letters with useMemo

```ts
  const sorted = useMemo(
    () => [...letters].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
    [letters]
  );
```

`[...letters]` creates a copy because `.sort()` mutates the array in place. Without the copy, we'd be modifying React state directly, which is forbidden and causes bugs.

The sort comparator subtracts the two timestamps. A negative result means `a` is older and should come first. This sorts letters from oldest to newest.

`useMemo` ensures this only re-runs when `letters` actually changes, not on every unrelated re-render.

### Toggling the form

```ts
  const [showForm, setShowForm] = useState(false);
```

A simple boolean state. The "Write a Letter" button shows when `false`. The form shows when `true`. The form's `onSubmit` handler calls `addLetter` and then immediately sets `showForm` back to `false`, hiding the form.

### The empty state

When `sorted.length === 0`, a placeholder with an envelope emoji and some text is rendered. This is a better user experience than showing nothing or a confusing empty list.

---

## `src/index.css` — The Paint Job

```css
@import "tailwindcss";
```

This single line pulls in the entire Tailwind CSS framework using Tailwind v4's new import-based approach. In Tailwind v4, there's no config file — utility classes like `bg-zinc-900`, `text-amber-400`, etc. are generated on the fly based on what you use in your markup.

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

The fadeIn animation starts invisible and 8px lower, ending fully visible at its natural position. The `animate-[fadeIn_0.6s_ease-out]` in LetterCard references this by name — Tailwind's arbitrary value syntax `[...]` allows using custom animations directly in class names.

---

## `src/main.tsx` — The Front Door

```ts
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`document.getElementById('root')` finds the empty `<div id="root">` in `index.html`. The `!` (non-null assertion) tells TypeScript "trust me, this element exists." `createRoot` creates a React root, and `.render(...)` injects the App component into it.

`<StrictMode>` is a development-only wrapper that double-invokes effects and state updaters to surface bugs. It does nothing in production. This is why `useEffect` with `setInterval` might seem to run twice in development — it's intentional, checking that your cleanup function works correctly.

---

## Data Flow Summary

1. **App mount** → `useLetters()` calls `loadLetters()` → reads from localStorage → sets initial state
2. **User creates letter** → `LetterForm` calls `onSubmit` → `addLetter` appends to state → React re-renders → `useEffect` fires → saves to localStorage
3. **Page refresh** → `loadLetters()` runs again → reads from localStorage → letters reappear
4. **Every second** → `Countdown`'s `setInterval` fires → updates `timeLeft` state → re-renders the displayed countdown
5. **When unlock time passes** → `LetterCard`'s `useMemo` recomputes `isUnlocked` → now `true` → content fades in → `Countdown` shows "Unlocked"

## The Three Pitfalls (and How This Code Avoids Them)

| Pitfall | Where We Handle It |
|---|---|
| `useEffect` infinite loop | We always include a dependency array `[letters]` or `[target]`. Never empty for effects that depend on changing values. |
| localStorage corruption | `loadLetters()` wraps `JSON.parse` in `try/catch`. If the data is garbage, we silently fall back to `[]`. |
| Date comparison with `==` | We always use `.getTime()` for arithmetic and comparisons. We never compare Date objects directly with `==` or `===`. |

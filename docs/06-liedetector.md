# Lie Detector

## The Lie: Statement 4

> `crypto.randomUUID()` throws a TypeError when the page is served over plain HTTP instead of HTTPS.

## Why It's False

Other Web Crypto methods (like `crypto.subtle.encrypt()`) do require HTTPS. But `randomUUID()` is different — it just generates a random ID. There's nothing sensitive about it. The people who wrote the spec made it available everywhere, HTTP included.

Try it on an HTTP page and it works fine. No TypeError, no crash.

The statement sounds true because most of the Web Crypto API is locked behind HTTPS. Statement 4 relied on you assuming `randomUUID()` worked the same way. It doesn't.

## The Other Four (All True)

**1.** Countdown originally used `useState` + `useEffect` with a `setInterval`. (The modernized version no longer does, but the statement described the implementation at the time of writing.)

**2.** Yes — `src/hooks/useLetters.ts:18-24` wraps `setItem` in a `try/catch`.

**3.** Yes — `src/components/LetterCard.tsx:23` is a plain `<=` comparison, no `useMemo`.

**5.** Yes — `src/components/LetterForm.tsx:15` rejects past dates with `if (new Date(unlockDate).getTime() <= Date.now()) return;`.

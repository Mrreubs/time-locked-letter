# Lie Detector — Five Statements, One Lie

## The Challenge

Five statements about the Time-Locked Letters codebase. Four are true, one is false.

```
1.  The Countdown component uses useState to store the computed time
    and useEffect to set up an interval that updates it every second.

2.  Writing to localStorage in the useLetters hook is wrapped in a
    try/catch to handle quota errors.

3.  The LetterCard's isUnlocked value is a plain expression —
    new Date(letter.unlockDate).getTime() <= now — not wrapped
    in useMemo.

4.  crypto.randomUUID() throws a TypeError when the page is served
    over plain HTTP instead of HTTPS.

5.  The LetterForm component validates on submit that the chosen
    unlock date is not in the past by comparing against Date.now().
```

---

## The Lie: Statement 4

### What it claims

> `crypto.randomUUID()` throws a TypeError when the page is served over plain HTTP instead of HTTPS.

### Why it's false

This statement was originally surfaced by Tool B in the cross-check audit (`docs/04-cross-check.md`). It sounded plausible because other Web Crypto APIs like `crypto.subtle.encrypt()` and `crypto.subtle.decrypt()` are indeed restricted to secure contexts (HTTPS or localhost). The assumption was that `randomUUID()` — living on the same `crypto` object — shared the same restriction.

It doesn't.

The WICG UUID specification (which standardized `crypto.randomUUID()`) explicitly states that the API is available in **all** contexts — both secure and insecure. The rationale: generating a random UUID has no security implications. It doesn't expose cryptographic keys, signing operations, or credential material. There is no reason to gate it behind HTTPS.

In practice (as of 2026):

| Browser | HTTP behavior | Verification |
|---|---|---|
| Chrome | Works fine | `crypto.randomUUID()` returns a valid UUID on HTTP pages |
| Firefox | Works fine | Same behavior |
| Safari | Works fine | Supported since Safari 15.4 |

**What actually happens on HTTP:** `crypto.randomUUID()` exists and returns a valid UUID string. No TypeError. No crash.

If `crypto.randomUUID()` were missing (hypothetical pre-2022 browser), `crypto.randomUUID` would be `undefined`, and calling `undefined()` would throw a `TypeError: crypto.randomUUID is not a function`. But this is a "not a function" error, not a "restricted to secure contexts" error. And in 2026, no mainstream browser is missing it.

### Why it was a good lie

The Web Crypto API has a well-known split: most methods live under `crypto.subtle` and require a secure context. `crypto.randomUUID()` is an outlier — it's on `crypto` directly, not `crypto.subtle`, and it sidesteps the restriction entirely. It looks like a mistake to anyone familiar with the crypto API surface, but it's intentional.

---

## The Truth: Statements 1–5

| # | Statement | Verdict | Evidence |
|---|---|---|---|
| 1 | Countdown uses useState + useEffect for its interval | **Outdated** (true before commit `07d436e`; Countdown is now a pure component driven by the `now` prop from `App`) | `src/components/Countdown.tsx` — no hooks |
| 2 | localStorage write is wrapped in try/catch | **True** | `src/hooks/useLetters.ts:18-24` |
| 3 | isUnlocked is a plain expression, not useMemo | **True** | `src/components/LetterCard.tsx:23` |
| 4 | crypto.randomUUID() throws on HTTP | **False** | Available in all contexts per WICG spec |
| 5 | LetterForm validates unlock date against Date.now() | **True** | `src/components/LetterForm.tsx:15` |

### The Two Lies Problem

Statement 1 was true when the challenge was written but became false after the `now`-polling modernization (commit `07d436e`) converted Countdown from a stateful component to a pure one. This is a **documentation drift** bug — the statements described a snapshot of the code, not the live code.

If the challenge were re-run against the current commit:
- Statement 1 would be the lie
- Statement 4 would also be the lie (two lies, no award)

The honest resolution: **the challenge had one intended lie (statement 4), but code changes introduced a second unintended lie (statement 1).** Both are false now.

---

## What We Learned

1. **Don't assume Web Crypto restrictions apply to every method.** `crypto.randomUUID()` is explicitly exempt from the secure-context requirement. Check the spec, don't assume based on nearby APIs.

2. **Cross-check audits are only as good as their research.** Tool B flagged `crypto.randomUUID()` as a crash-on-HTTP issue with confidence. It was wrong. Always verify deployment assumptions with the actual spec, not common wisdom.

3. **The best lies look like the truth.** The secure-context restriction on Web Crypto is widely known. Statement 4 exploited that knowledge to manufacture a plausible-sounding falsehood. The only way to catch it was to know the specific exception.

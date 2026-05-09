# Security Hardening Plan

Fix every issue from the security scan plus two extras (HIBP, file-type validation). Grouped by layer for clarity.

## 1. Database / RLS migration

- **Friends self-accept fix**: Replace the `Addressee can update status` UPDATE policy on `friends`. Only the addressee can change status to `accepted` or `rejected`. Requester can no longer self-accept.
- **shared_documents**: Add an explicit restrictive UPDATE policy (deny all) to make append-only intent explicit.
- **Storage `documents` bucket**: Add an UPDATE policy requiring `auth.uid()::text = (storage.foldername(name))[1]` so users can't overwrite each other's files.
- **Profiles privacy**: Restrict `Profiles are readable by everyone` to authenticated users only (still readable by all logged-in users so friend search/leaderboards work, but anonymous visitors can't scrape).
- **Daily XP cap helper**: Add a SQL function `daily_xp_total(uid)` used by `award-xp` to enforce a 500 XP/day server-side cap.

## 2. Edge functions hardening

Apply to all 5 functions (`award-xp`, `extract-text`, `friends-action`, `generate-study`, `generate-summary`):

- **No leaked errors**: Replace every `String(e)` / `e.message` in 500 responses with `"Internal server error"`. Log full error to `console.error` server-side only.
- **Tighter CORS**: Read `origin` from request and only echo back if it's in an allowlist (preview URL, published URL, localhost). No more wildcard `*`.

Function-specific:

- **award-xp**:
  - Validate `reason` against an allowlist (`summary | flashcards | quiz | quiz_perfect | friend_accept | share_summary | daily_streak`).
  - Enforce server-side daily cap (500 XP/day per user) using the new SQL helper.
  - Cap per-call amount at 200 (was 2000).
- **friends-action**: Add Zod-style validation for `action`, `identifier` (max 255), `targetId`/`friendRowId` (uuid format).
- **extract-text**: Validate uploaded file MIME type & extension against `pdf | docx | pptx` allowlist; reject anything else with a 400. Cap file size at 20 MB.

## 3. Frontend changes

- **Signup user-enumeration fix** (`src/routes/signup.tsx`): Show one neutral message regardless of whether email exists ("Check your inbox to verify your account").
- **Vault upload**: Mirror server-side file-type/size checks on the client for nicer UX (already partly there — just tighten).

## 4. Auth configuration

- Enable **Leaked Password Protection (HIBP)** via `configure_auth`.

## 5. Verify

- Re-run the security scan after deploy and confirm all 🔴 errors resolved and warnings either fixed or explicitly accepted (e.g. profile readability).
- Update the project's security memory documenting what's intentionally public (profile basics for friend search) and what's not.

---

## Out of scope (call out, don't change)

- **Profile readability**: I'll restrict to *authenticated* users (not fully private), because friend search and any future leaderboard need it. If you want stricter (only friends can see your XP/streak), say so and I'll add a second pass.
- **Rate limiting beyond the daily XP cap**: True per-IP rate limiting needs Redis/Upstash. The daily cap covers the main abuse vector for now.

After your approval I'll run the migration first, then patch the edge functions and frontend in one pass.

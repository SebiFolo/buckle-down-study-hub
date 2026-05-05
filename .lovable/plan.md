
# Buckle Down — Phase 1 Plan

## Important note on stack

Your spec calls for a separate Express + Prisma + custom JWT server. Lovable's runtime is **serverless (Cloudflare Workers)** and cannot host a long-running Express process. To stay as close to spec as possible while keeping the app actually deployable, I'll use:

- **PostgreSQL** (managed via Lovable Cloud — same Postgres under the hood, accessed via the JS client + RLS instead of Prisma)
- **TanStack Start server functions** in place of Express routes (same REST-style boundaries, type-safe)
- **Lovable Cloud Auth** (email/password + email verification + password reset built in — same flows you specified, just without hand-rolled JWT/bcrypt code, which would also require an external server)
- **Lovable AI Gateway** (Gemini 2.5 Flash) for summaries/flashcards/quizzes
- **Web Speech API** for TTS

Everything else (schema shape, features, gamification rules, XP values, branding) follows your spec.

## Phase 1 scope

Auth → Vault + AI Summaries → Flashcards → Quizzes → XP/Levels/Streak (basic).
**Phase 2 (later):** Daily/Weekly Quests, Friends + Sharing, OpenAI TTS, Profile editing, level-up confetti polish.

---

## Branding & theme

- Coffee palette wired into Tailwind/CSS tokens:
  - Primary `#6F4E37`, Secondary `#C8A97E`, Accent `#3E2723`
  - Background `#FDF6EC`, Text `#2C1A0E`
  - Success/XP `#A5D6A7`, Highlight `#FFCC80`
- Inter font, rounded cards, warm shadows
- Buck logo: SVG mark of a stylized male deer head with antlers, used in header + empty states
- Sidebar nav on desktop, bottom tab bar on mobile

---

## Database (Postgres, RLS-protected)

- `profiles` — user_id (FK auth.users), username, avatar_url, level, xp, streak_count, longest_streak, last_active_date
- `documents` — id, user_id, title, file_type, file_url, raw_text, summary, created_at
- `flashcard_sets` + `flashcards`
- `quizzes` + `quiz_questions` (options jsonb, correct_answer)
- `quiz_attempts` — score, completed_at
- `xp_events` — user_id, amount, reason, created_at (audit trail for XP)

Tables for `shared_documents`, `quests`, `user_quests`, `friends` will be added in Phase 2.

Roles handled via separate `user_roles` table pattern (none needed in Phase 1, scaffolded for later).

---

## Pages

### Auth
- `/signup` — username, email, password, confirm. Sends verification email.
- `/login` — email/password + "Forgot password?" link. Blocks unverified users.
- `/verify-email` — handles token, redirects with toast.
- `/forgot-password` — email input, sends reset link.
- `/reset-password` — new password form.

### `/dashboard`
- Welcome banner with username + buck logo
- Streak tracker with flame icon (lit if studied today)
- Level + XP bar with buck-themed title ("Level 3 – Trail Grazer")
- Recent activity (last 3 summaries/quizzes)
- Placeholder cards for Quests/Friends (Phase 2)

### `/vault`
- Drag-and-drop upload (PDF, DOCX, PPTX) + Google Docs shareable-link input
- Server function parses file → extracts text → calls AI Gateway for summary → saves
- Loading state: "🦌 Buckle is reading your notes..."
- Library grid of document cards: title, type icon, date, excerpt, actions
- Summary modal with formatted markdown rendering + **Listen** (Web Speech) play/pause/stop
- Awards +30 XP per summary

### `/study`
Tabs: **Flashcards** | **Quizzes**

- **Flashcards:** create set manually OR AI-generate 10–15 from a vault doc. Study mode flips cards, "Got it ✓ / Review again ✗", progress indicator. +20 XP per completed set.
- **Quizzes:** create manually OR AI-generate 5–10 MCQs from a vault doc. One-question-at-a-time UI, instant color feedback, score screen. +50 XP, +20 bonus on perfect.

### `/profile`
- Avatar (default buck), username, email
- Stats: total XP, level + title, current streak, longest streak, total summaries, total quizzes
- Phase 2: change username/password, avatar upload

---

## Gamification (Phase 1)

- XP awards as specified for: summary (+30), quiz (+50, +20 perfect bonus), flashcard set (+20), daily streak (+10)
- Level thresholds: 0, 200, 500, 900, 1400, +150 more each level
- Buck-themed titles (Fawn → Young Buck → Trail Grazer → Forest Scout → Meadow Scholar → … → Antler Sage @ 10 → Grand Buck @ 20)
- Streak: increment on first study action of the day, reset if a day is missed (server-side check on each XP event)
- Animated XP bar fill + toast on XP gain
- Simple level-up modal (confetti polish in Phase 2)

---

## UX

- Responsive (mobile-first), bottom tab bar on mobile, sidebar on desktop
- Sonner toasts for XP, errors, successes
- Loading skeletons on vault/study lists
- Empty states with buck illustration + friendly copy
- All modals dismissible & keyboard-accessible

---

## Technical details (for reference)

- File parsing in server functions: `pdf-parse` for PDF, `mammoth` for DOCX, `pptx2json` (or fallback text extraction) for PPTX. Google Docs handled by extracting the doc ID from a public share URL and fetching the export endpoint.
- File storage: Lovable Cloud Storage bucket `documents/` (private, RLS-scoped to user)
- AI Gateway model: `google/gemini-2.5-flash` for summaries; structured tool-calling for flashcards/quizzes to guarantee valid JSON
- TTS: Web Speech API client-side (no extra cost / no key)
- Rate limiting + email verification + password reset: handled by Lovable Cloud Auth
- Input validation with Zod on every server function; file MIME + size checks before parsing
- All DB access through RLS policies — users only see their own rows

---

## Out of scope for Phase 1 (Phase 2 backlog)

Daily/weekly quests + assignment cron, friends + requests + activity feed, document sharing, OpenAI TTS voices, level-up confetti, avatar uploads, profile editing.

After you approve, I'll build Phase 1 end-to-end and we can iterate from there.

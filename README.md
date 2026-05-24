# Buckle Down Study Hub

A gamified, AI-powered study platform. Upload your notes, get AI-generated summaries, create quizzes and flashcards, and earn XP through a leveling, streak, and quest system. Study smarter and stay motivated.

---

## Features

### Study Vault
- Upload notes in **PDF, DOCX, PPTX, TXT, or Markdown** format (up to 20 MB), or paste a **Google Docs link**
- Files are parsed server-side with magic-byte validation before processing
- Each document is stored and accessible from your personal vault

### AI Study Tools
- **Summaries** — AI reads your notes and generates a structured Markdown summary with headings, bullet points, and bolded key terms
- **Quizzes** — generates 5–10 multiple-choice questions from your notes using structured AI output (tool use), ensuring every question has exactly 4 options and a valid correct answer
- **Flashcards** — generates 8–15 front/back flashcard pairs ready for review
- **Contextual hints** — during a quiz, spend a Quiz Hint item to get a short AI-generated nudge that guides your reasoning without revealing the answer

All AI features use **Google Gemini 2.5 Flash** via the Lovable AI Gateway. All AI calls happen inside Supabase Edge Functions — never from the browser.

### Gamification

| Mechanic | Detail |
|---|---|
| XP | Earned by completing summaries, quizzes, flashcard sets, and social actions |
| Daily cap | 500 XP per day, 200 XP per individual action — intentional anti-grinding design |
| Streak bonus | A small XP bonus is awarded for the first streak-eligible action each day |
| Leveling | 20 levels from **Fawn** to **Grand Buck**, with increasing XP thresholds |
| Daily streak | Consecutive days with a quiz or summary — tracked with a UTC date comparison |
| Streak Freeze | Shop item that auto-consumes from inventory when you miss a day, keeping your streak alive |
| Quests | Daily and weekly objectives (e.g. "Take a quiz", "Generate 3 summaries") that award XP and coins on completion |
| Shop | Spend coins on **Streak Freeze** (max 3 in stock) and **Quiz Hint** consumables |

### Social
- Send and accept friend requests
- Leaderboard to compare XP with friends
- In-app notifications for friend activity

### Profile & Customisation
- Custom username (3–30 characters, alphanumeric + underscore)
- 8 animal avatars to choose from (Buck Scout, Fox Scholar, Owl Sage, and more)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TanStack Start |
| Routing | TanStack Router (file-based, auto-generated route tree) |
| Data fetching | TanStack React Query |
| Styling | Tailwind CSS 4 + shadcn/ui (New York style, Radix UI primitives) |
| Language | TypeScript 5 |
| Build | Vite 7 |
| Package manager | Bun |
| Database & Auth | Supabase (PostgreSQL + Row-Level Security + Auth) |
| Edge Functions | Deno runtime (9 functions) |
| AI model | Google Gemini 2.5 Flash (via Lovable AI Gateway) |
| Validation | Zod |
| Linting | ESLint 9 + Prettier |
| Testing | Vitest |
| CI | GitHub Actions |

---

## Architecture

```
Browser (React)
    │
    ├── Supabase JS client  ──►  PostgreSQL (RLS enforced per user)
    │
    └── Edge Functions (Deno, JWT-verified on every request)
            ├── extract-text       – parse PDF / DOCX / PPTX / TXT / MD / Google Docs
            ├── generate-summary   – AI summary from extracted text
            ├── generate-study     – AI quiz or flashcard set (structured output)
            ├── generate-hint      – contextual quiz hint without revealing the answer
            ├── generate-quests    – seed daily/weekly quests for the user
            ├── award-xp           – XP + streak logic, daily cap enforcement
            ├── claim-quest        – validate and reward completed quests
            ├── shop-buy           – purchase or consume inventory items
            └── friends-action     – send / accept / remove friends
```

**Security model:**
- Every edge function verifies the user's JWT before doing anything
- Supabase RLS ensures users can only read and write their own data at the database level
- Signup uses a neutral error message to prevent user enumeration

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) (package manager and test runner)
- A [Supabase](https://supabase.com) project with the migrations applied

### Environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Edge functions read `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `LOVABLE_API_KEY` from Supabase secrets — set these via the Supabase dashboard or CLI.

### Install and run

```bash
bun install       # install dependencies
bun run dev       # start dev server at http://localhost:5173
```

### Other commands

```bash
bun run build     # production build
bun run preview   # preview production build locally
bun run lint      # ESLint check
bun run format    # Prettier formatting
bun run test      # run unit tests
```

---

## Testing

Unit tests are written with **Vitest** and cover the pure business logic of the application.

```bash
bun run test
```

| Test file | What it covers |
|---|---|
| `src/lib/leveling.test.ts` | XP thresholds, level calculation, level titles, progress percentage |
| `src/lib/auth-schema.test.ts` | Signup validation: username rules, email format, password strength requirements |
| `src/lib/quests.test.ts` | Daily/weekly key generation, ISO week calculation including year-boundary edge cases, period window start times |
| `src/lib/utils.test.ts` | Markdown stripping: heading removal, bold/italic, links, whitespace collapsing |

**75 tests, 4 suites** — all passing.

---

## CI

GitHub Actions runs on every push and pull request to `main` and `develop`.

| Job | What it does |
|---|---|
| Unit Tests | `bun run test` — all 75 Vitest tests must pass |
| Type Check | `tsc --noEmit` — no TypeScript errors allowed |
| Build | `bun run build` — production build must succeed; artifacts kept for 7 days |

Jobs run independently and in parallel. A failing test suite blocks the other checks from being considered green.

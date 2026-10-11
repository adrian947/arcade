# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project overview

Arcade Vault — a browser-based arcade game platform (retro neon/CRT look, UI text in Spanish) where players compete for high scores. Next.js 16 App Router + React 19 + TypeScript + Tailwind v4, Supabase (Auth + Postgres + RLS) for accounts and rankings, Resend for the contact form.

Playable games with real engines: **ASTEROIDES**, **TETRIS**, **ARKANOID**, **SNAKE**. The rest of the catalog in `lib/data.ts` runs a simulated arena (demo).

For details on implemented games (ids, specs, engines, controls, scoring, origin), read `references/implemented-games.md` when needed. Keep it updated when a new game is added.

## Commands

```bash
npm run dev      # start Next.js dev server (Turbopack)
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint (flat config: eslint-config-next core-web-vitals + typescript)
```

There is no test runner configured (no test script, no test framework in `package.json`).

## Environment

Copy `.env.example` to `.env.local` (all `.env*` except `.env.example` are gitignored). Restart `npm run dev` after changes.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — public by design; security comes from RLS.
- `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` — used by `app/api/contact/route.ts`.
- `EMAIL_LOGIN`, `PASSWORD_LOGIN` — prefill `/login` only when `NODE_ENV === "development"`; never sent to the client in production.

`.mcp.json` configures the Supabase MCP server for this project (use it for migrations, SQL, advisors, type generation).

## Architecture

### Routes (`app/`)

- `/` landing (`app/page.tsx`, pieces in `components/home/`)
- `/juegos` game library · `/juego/[id]` game detail + top 10 (`components/game-detail.tsx`) · `/jugar/[id]` player (`components/game-player.tsx`)
- `/salon` Hall of Fame: per-game leaderboard tabs + the user's best mark
- `/login` sign in / sign up (`page.tsx` server component passes dev defaults to `login-form.tsx`)
- `/about` + contact form → `POST /api/contact` (Resend; validation + honeypot `website` field)

`app/layout.tsx` wraps everything in `UserProvider` and renders `Nav`. Fonts: Press Start 2P (`--font-pixel`), JetBrains Mono, Courier Prime. Visual styles live mostly in `app/globals.css` (including `.cover-*` game covers and `.game-canvas`).

### Data layer (`lib/`)

- `lib/data.ts` — static catalog `GAMES` (`Game` type: `id`, `title`, `cat`, `cover`, `color`, …). Source of game ids.
- `lib/supabase/client.ts` — single browser client typed with `database.types.ts` (regenerate types via Supabase MCP after schema changes).
- `lib/user.tsx` — `UserProvider` / `useUser()`: session + `profiles` lookup, `signIn`, `signUp` (username `^[A-Z0-9_]{3,10}$`, uppercased; password ≥ 8), `logout`. Errors returned as uppercase Spanish strings.
- `lib/scores.ts` — `saveScore`, `fetchLeaderboard`, `fetchMyBest` (rank = rows with higher score + 1).
- `lib/use-leaderboard.ts` — `useLeaderboard(gameId, limit)` and `useMyBest(gameId, userId)` hooks.

### Database (`supabase/migrations/`)

- `profiles` (1:1 with `auth.users`, created by trigger `handle_new_user` from `raw_user_meta_data.username`).
- `scores` (one row per saved game; insert only own rows via RLS).
- `games` (catalog of games with real ranking). `scores.game_id` has an FK to `games.id` — **saving a score fails if the game has no row in `games`**.
- View `leaderboard` (`security_invoker`): best score per user per game.
- Public read on all tables; one migration per new game (`insert into public.games …`).

### Game engines (`games/`)

- `games/types.ts` — engine contract: `GameFactory(canvas, { onStats, onGameOver })` returns `{ pause, resume, end, destroy }`. `end()` returns score without firing `onGameOver`; `destroy()` is idempotent and must cancel rAF + remove listeners.
- `games/registry.ts` — `ENGINES` map `id → { factory, lives? }`. `lives: false` hides the Lives stat in the HUD (tetris, snake). Ids not in the map use the simulated arena.
- One folder per game: `asteroids/`, `tetris/`, `arkanoid/` (`levels.ts`, `sprites.ts`), `snake/` (`sprites.ts`). Assets in `public/games/<id>/`.
- Platform owns HUD (score/lives/level), pause (button, `P`/`Esc`, auto-pause on tab hidden) and game-over/save UI — engines must not draw those nor bind `P`/`Esc`. Engines read colors from CSS tokens (see `readPalette` pattern in `games/asteroids/engine.ts`).

Adding a real game touches: engine in `games/<id>/`, `games/registry.ts`, entry in `lib/data.ts`, `.cover-<id>` in `globals.css`, and a migration inserting the row into `public.games`.

### References

`references/started-games/` holds the original vanilla-JS games that get ported; `references/templates/` holds the original JSX/HTML design mockups. Reference only — not part of the app build.

## Workflow: spec-driven development

Features are planned as specs in `specs/NN-slug.md` (status words: `Borrador` → `Aprobado` → `Implementado`), then implemented on a branch `spec-NN-slug` and merged via PR. Implemented so far: 01 visual MVP, 02 landing + `/juegos`, 03 about + Resend contact, 04 Supabase auth + ranking, 05 Asteroides, 06 `games` table + FK, 07 Tetris, 08 Arkanoid, 09 Snake.

Project skills (`.claude/skills/`, user-invoked only):

- `/spec <descripción>` — guided spec design: asks clarifying questions, writes `specs/NN-*.md`. No code.
- `/spec-impl <NN-nombre>` — validates the spec is approved, creates/switches to branch `spec-NN-slug` (controlled by `AutoCreateBranch` in `specs/.spec-config.yml`) and implements the whole plan in one go.
- `/nuevo-juego <juego o carpeta de references/started-games>` — writes the spec for adding a real game (engine + registry + catalog + cover + `public.games` row) using `game-spec-template.md`. No code; implement afterwards with `/spec-impl`.
- `/game-jam <tema>` — picks two distinct design angles for a theme and launches two `game-jam` agents in parallel; each writes a full game spec in `specs/game-jam/<tema-slug>-<id>.md` (status `Borrador`, unnumbered). No code. To implement one, move it to `specs/NN-juego-<id>.md`, approve it and run `/spec-impl`.
- `/neko` — playful cat-persona communication mode.

Project subagents (`.claude/agents/`):

- `game-planner` — decides which game to add next: scores top 3 candidates against platform fit and returns a brief for `/nuevo-juego`. Keeps a versioned memory of past suggestions (sugerido / aceptado / descartado / implementado) in `.claude/agent-memory/game-planner/`.
- `game-jam` — designs ONE original game from a theme + assigned angle and writes its spec using `.claude/skills/nuevo-juego/game-spec-template.md`. Non-interactive (records assumptions in Decisiones). Launched in pairs by `/game-jam`; subagents can't spawn subagents, so orchestration lives in the skill.

## Diseño UI

Para trabajo de diseño visual/UI (nuevas pantallas, componentes, rediseños), usar skill `/frontend-design` antes de escribir código.

Capturas de Playwright: guardar en `.playwright-screenshot/` (gitignored), no en la raíz.

## Next.js version note

This project pins a Next.js version ahead of general training data (16.3.5). `AGENTS.md` (imported above) is regenerated by `next dev` on every run — read `node_modules/next/dist/docs/` (topics: `01-app`, `02-pages`, `03-architecture`) before relying on remembered App Router APIs, since conventions may have changed.

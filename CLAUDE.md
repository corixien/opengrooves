# Opengrooves

Login-free web app: anyone creates drum grooves (grid editor, max 20 bars, 1-8 beats each, 16ths or triplets per bar), browses/searches/filters them, plays them with samples + metronome, forks them.

## Stack
React + Vite + TS (client/), Express + TS (server/), shared zod schema (shared/groove.ts), Postgres (embedded PGlite locally, Neon via DATABASE_URL in prod), Web Audio API.

## Commands
- `npm run dev` client :5173 (proxies /api) + server :3001
- `npm run check` typecheck, `npm test` vitest, `npm run build`, `npm start` (serves dist + API)
- `python3 scripts/slice-samples.py <recording.wav>` re-cuts the kit into public/samples (16 sounds x soft/medium/hard); swap via manifest.json

## Invariants
- Bar rows: one string per instrument, one char per step ('-' none, '1' ghost, '2' normal, '3' accent); length = quarters(beats*4/den)*(triplet?3:4). Validated in shared/groove.ts on client and server.
- No accounts: owner edits (PUT) and deletes via token (localStorage, only sha256 stored); likes keyed by anonymous client id.
- Tags/difficulty are fixed id lists translated in client/src/i18n.ts. Focus options live in DB table focus_options (id, label_de, label_en, sort); admins add rows in Neon (both languages required), defaults seeded on startup (never overwritten). title/author/description are free text, untranslated.
- Non-owners file delete requests (table delete_requests, cascade on groove delete); admin handles them in Neon. Forks are independent copies (fork_title is a snapshot).
- Playback is one global engine: it keeps playing across pages (a groove page adopts its own groove), Space toggles it everywhere, only volumes are persisted (og.volume).
- Never run tests/migrations against Neon production (project gentle-morning-60095256, branch production). Local dev uses PGlite only.
- Design: flat, no transitions/animations, light+dark via CSS vars.

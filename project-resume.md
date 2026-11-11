# Opengrooves - project resume

Login-free web app to create/share/play drum grooves. Repo: github.com/corixien/opengrooves (public, branch main). Read CLAUDE.md for stack, commands, invariants.

## Layout
- shared/groove.ts: zod schema, bar model (rows as strings of -123), helpers, tests
- server/: Express app (app.ts), db.ts (PGlite local / pg via DATABASE_URL), API tests
- client/src/: audio/engine.ts (Web Audio scheduler, metronome, playhead marks), components/Bars.tsx (grid editor, SVG notation, playhead), pages/, i18n.tsx (DE/EN), styles.css (flat, no transitions)
- public/samples: CC0 kit + manifest.json (swap kit by editing manifest); scripts/fetch-samples.sh, scripts/seed.ts (demo grooves)

## Current state
V1 localhost complete: M1 scaffold/DB/API, M2 grid editor, M3 player (samples, metronome, count-in, loop, volumes, unit, playhead), M4 home (search/filter/sort/likes/plays), M5 notation preview, fork, DE/EN, dark/light. Typecheck, tests, build pass.

## Next / open
- Deploy: Render (web service: build `npm run build`, start `npm start`) + Neon (DATABASE_URL; never test against branch production)
- Possible: drag-paint on touch, MIDI/PDF export, report/moderation, real engraving polish (rests, flags)
- Known limits: notation is simplified (no rests/flags); background tabs throttle the scheduler timer.

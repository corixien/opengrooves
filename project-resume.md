# Opengrooves - project resume

Login-free web app to create/share/play drum grooves. Repo: github.com/corixien/opengrooves (public, branch main). Read CLAUDE.md for stack, commands, invariants.

## Layout
- shared/groove.ts: zod schema, bar model (rows as strings of -123), helpers, tests
- server/: Express app (app.ts), db.ts (PGlite local / pg via DATABASE_URL), API tests
- client/src/: audio/engine.ts (Web Audio scheduler, metronome, playhead marks), components/Bars.tsx (grid editor, SVG notation, playhead), pages/, i18n.tsx (DE/EN), styles.css (flat, no transitions)
- public/samples: own recorded kit (16 sounds x soft/medium/hard, 48 FLAC, 3.6 MB) + manifest.json; cut from the recording with `python3 scripts/slice-samples.py <wav>` (group names in NAMES there); scripts/seed.ts (demo grooves)
- Instruments (shared/groove.ts, top to bottom): splash, china, crash2, crash, rideBell, ride, hhOpen, hhHalf, hhClosed, hhPedal, tomHigh, tomMid, tomLow, snare, sidestick, kick. Heads/steps in Bars.tsx NOTE; hats choke each other in engine.ts

## Current state
V1 localhost complete: M1 scaffold/DB/API, M2 grid editor, M3 player (samples, metronome, count-in, loop, volumes, unit, playhead), M4 home (search/filter/sort/likes/plays), M5 notation preview, fork, DE/EN, dark/light. Typecheck, tests, build pass.

## Update (round 2)
Custom Select component, Lexend font (@fontsource-variable/lexend), panel layout in editor/detail, sticky player dock, focus options moved to DB (GET /api/options, admin-editable in Neon), graceful PGlite shutdown.

## Update (round 3)
Bars side by side in one horizontal scroller (follows playhead), click cycle normal -> accent -> ghost -> off, continuous playhead (extrapolated between beat marks), equal-height panels, #root flex so the dock sits at the bottom, rounded logo.

## Update (round 4)
Time signatures n/den (den 1,2,4,8,16; max 8 quarters, max 16 beats; triplets only den<=4; BPM = quarters/min), card play buttons (one at a time, no metronome), preview shows first 2 bars and follows playhead, language dropdown, flat dropdown borders. Fixed .grid class collision that broke horizontal scroll.

## Next / open
- Deploy: Render (web service: build `npm run build`, start `npm start`) + Neon (DATABASE_URL; never test against branch production)
- Possible: drag-paint on touch, MIDI/PDF export, report/moderation, real engraving polish (rests, flags)
- Known limits: notation is simplified (no rests/flags); background tabs throttle the scheduler timer.

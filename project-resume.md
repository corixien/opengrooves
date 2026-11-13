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

## MIDI + grid editing (2026-11-12)
- Grid: right click / right-drag erases; during a drag sound plays only for newly placed notes (visited set in BarGrid); clicking an instrument label plays it.
- shared/midi.ts: GM drum map, velocity->level, SMF parser, midiToBars (first time signature, 16th vs triplet per bar, max 20 bars), locateStep (live quantize: step/eighth/quarter). Tests in shared/midi.test.ts.
- client/src/audio/useMidiInput.ts (Web MIDI, Chrome/Edge); EditorPage toolbar: import .mid, connect input, Record (writes while the player runs, compensates output + MIDI latency), quantize select.
- Not verified: live MIDI input with a real keyboard (no device in the test browser).

## Playback + list round (2026-11-13)
- Engine (audio/engine.ts): pause()/seek()/start(from); settings countInBars (1-4) and loopCount (0 = endless); onFullPass fires once per run for the first complete pass from the start (pause/resume or restart = new run) -> audio/playCount.ts posts /play and bumps local counters (usePlays). Groove.forks (count of grooves with fork_of = id) added server-side.
- usePlayer: Space (anywhere except text inputs) and the Play button = pause/resume, quick double press = restart; ruler click in grid view seeks (snapped to the cell). A card preview of groove X keeps playing when its page opens (engine.grooveId handover; deferred stop for StrictMode).
- Samples re-cut with early raised-cosine fade-outs (25% drums, 50% cymbals). Favicon: svg rx=10 plus 32px png / apple-touch / ico.
- Open question for user: metallic samples at very high BPM (see chat): ideas = per-instrument voice choke, master headroom/limiter instead of the compressor, avoid stacking the same long cymbal sample.

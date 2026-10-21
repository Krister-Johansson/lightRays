# LightRays

An optics puzzle built with three.js: rotate mirrors to guide a laser into the receiver.

This is the first playable proof of concept: one laser, one receiver, rotatable mirrors,
fixed mirrors and a "must hit" rule, across three short levels.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm test         # level solvability + ray tracer tests (vitest)
npm run build    # type-check and production build into dist/
npm run lint     # oxlint
```

## How to play

- Click a mirror to select it. A 360° dial appears around it.
- Drag the blue handle to rotate. Keep it close for 5° steps, drag it past the first dashed
  ring for 1° steps and past the outer ring for 0.1° steps. Hold Shift to snap to 15°.
- Keyboard: Tab cycles mirrors, arrow keys nudge 1° (Shift 15°, Alt 0.1°), Esc deselects.
- Light the receiver: a pulse of light runs down the beam, the receiver bursts and the
  **Finish round** button unlocks (or press Enter) to move on. Mirrors outlined with an amber diamond must be part of the beam's path.
  Mirrors on a screwed plate are fixed.

## Code layout

| Path | What it does |
| --- | --- |
| `src/game/trace.ts` | Pure 2D ray tracer (mirrors, walls, receiver). No three.js. |
| `src/levels/*.json` | One JSON file per level (board pixels, 1120 × 620 board). |
| `src/game/schema.ts` | zod schema: `parseLevel` (import/validate) and `serializeLevel` (export). |
| `src/game/levels.ts` | Loads every level file, validates it and sorts by id. |
| `src/game/levels.test.ts` | Brute-forces every level to prove it's solvable and not pre-solved. |
| `src/game/Game.ts` | three.js scene, bloom, rotation dial, input and render-on-demand loop. |
| `src/components/` | React HUD: top bar, dial angle readout, kit tray, finish-round button. |

The scene only renders when something changes or an animation is running, so an idle board
costs nothing.

## Levels

Each level is a JSON file in `src/levels/`, named after its id (`1-4.json`). To add one, copy an
existing file, change the id and layout, and run `npm test`: it validates the file and brute-forces
the mirrors to prove the level can be solved and isn't solved at the start. Files point at
`level.schema.json`, so editors like VS Code autocomplete and flag mistakes. After changing
`src/game/schema.ts`, regenerate it with `npm run levels:schema`.

`parseLevel()` and `serializeLevel()` in `src/game/schema.ts` are the import/export path for a
future level editor or sandbox mode.

## Design

Follows the approved LightRays design canvas: dark matte board, glowing beams, slightly tilted
camera, no sidebar while playing, rotation dial with angle readout.

## Claude skills

`.claude/skills/` holds UI polish and motion skills from
[emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT), so future Claude sessions
in this repo use them: `emil-design-eng`, `animate`, `apple-design`, `animation-performance`,
`review-animations` and `find-animation-opportunities`.

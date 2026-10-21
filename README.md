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
- Light the receiver. Mirrors outlined with an amber diamond must be part of the beam's path.
  Mirrors on a screwed plate are fixed.

## Code layout

| Path | What it does |
| --- | --- |
| `src/game/trace.ts` | Pure 2D ray tracer (mirrors, walls, receiver). No three.js. |
| `src/game/levels.ts` | Level data in board pixels (1120 × 620 board). |
| `src/game/levels.test.ts` | Brute-forces every level to prove it's solvable and not pre-solved. |
| `src/game/Game.ts` | three.js scene, bloom, rotation dial, input and render-on-demand loop. |
| `src/components/` | React HUD: top bar, dial labels, kit tray, level-complete card. |

The scene only renders when something changes or an animation is running, so an idle board
costs nothing.

## Design

Follows the approved LightRays design canvas: dark matte board, glowing beams, slightly tilted
camera, no sidebar while playing, rotation dial with angle readout.

## Claude skills

`.claude/skills/` holds UI polish and motion skills from
[emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT), so future Claude sessions
in this repo use them: `emil-design-eng`, `animate`, `apple-design`, `animation-performance`,
`review-animations` and `find-animation-opportunities`.

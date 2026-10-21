# LightRays

An optics puzzle built with three.js: rotate and place optics to guide lasers into receivers.

It has a main menu, a level select that remembers your progress (in localStorage), three
playable levels and a sandbox where you can build and test levels with every piece.

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
- The (?) button in the top bar shows all controls.
- Light the receiver: a pulse of light runs down the beam, the receiver bursts and the
  **Finish round** button unlocks (or press Enter) to move on. Mirrors outlined with an amber diamond must be part of the beam's path.
  Mirrors on a screwed plate are fixed.

## Pieces

| Piece | Behaviour |
| --- | --- |
| Laser | Emits a beam in its colour (red, green, blue, yellow, magenta, cyan, white). |
| Mirror | One silvered side, the back absorbs. |
| Double mirror | Reflects on both faces. |
| Splitter | Half the beam passes, half reflects. |
| Prism | Refracts, and fans mixed light out into red, green and blue. |
| Colour filter | Only its colour gets through. |
| Glass block | Refracts in and out, so the beam leaves parallel but shifted. |
| Open receiver | Lit from any side. Can require an exact colour. |
| Tube receiver | Only lit when the beam enters the mouth head-on. |
| Wall | Blocks light. Resizable. |

## Sandbox

Open it from the menu (`#/sandbox`). Drag pieces from the left palette onto the board, drag a
piece off the board to delete it, rotate with the dial and resize walls and glass with their
handles. The right inspector sets who places each piece (fixed, rotate only, or in the
player's kit), "must be hit", colour and size. **Test play** plays your board as a level, with
kit pieces moved into the tray. **Export** downloads the level JSON (your layout is saved as
the solution and the rotatable pieces are scrambled), **Import** loads one back. The board
autosaves in your browser.

## Code layout

| Path | What it does |
| --- | --- |
| `src/game/trace.ts` | Pure 2D ray tracer with branching beams and colour masks. No three.js. |
| `src/game/pieces.ts` | Shared piece geometry and labels, used by the tracer and the scene. |
| `src/game/pieceMeshes.ts` | three.js meshes for each piece type. |
| `src/game/levelTools.ts` | Board vs kit pieces, applying solutions, making a sandbox board playable. |
| `src/levels/*.json` | One JSON file per level (board pixels, 1120 × 620 board). |
| `src/game/schema.ts` | zod schema: `parseLevel` (import/validate) and `serializeLevel` (export). |
| `src/game/levels.ts` | Loads every level file, validates it and sorts by id. |
| `src/game/levels.test.ts` | Proves every level is solvable and not pre-solved. |
| `src/game/Game.ts` | three.js scene, bloom, dial, drag/place/resize, play and edit modes. |
| `src/screens/` | Menu, level select, play and sandbox screens (hash routes `#/`, `#/levels`, `#/play/1-1`, `#/sandbox`). |
| `src/components/` | HUD, dial readout, kit tray, finish button, palette, inspector, previews. |

The scene only renders when something changes or an animation is running, so an idle board
costs nothing.

## Levels

Each level is a JSON file in `src/levels/`, named after its id (`1-4.json`). The easiest way to
make one is to build it in the sandbox and export it. A level has a list of `pieces`, each with
a `type`, centre `x`/`y`, `angle` (degrees, counter-clockwise) and `lock`: `fixed`, `rotate`
(player can turn it) or `kit` (starts in the player's tray). An optional `solution` stores the
solved placement of each movable piece. `npm test` validates every file and proves the level
can be solved and isn't solved at the start. Files point at `level.schema.json`, so editors like
VS Code autocomplete and flag mistakes. After changing `src/game/schema.ts`, regenerate it with
`npm run levels:schema`.

## Design

Follows the approved LightRays design canvas: dark matte board, glowing beams, slightly tilted
camera, no sidebar while playing, rotation dial with angle readout.

## Claude skills

`.claude/skills/` holds UI polish and motion skills from
[emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT), so future Claude sessions
in this repo use them: `emil-design-eng`, `animate`, `apple-design`, `animation-performance`,
`review-animations` and `find-animation-opportunities`.

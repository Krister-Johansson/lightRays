# LightRays

three.js laser optics puzzle. Vite + React 19 + TypeScript + Tailwind v4.

- `npm run dev` to play, `npm test` for the tracer and level solvability tests, `npm run build` to type-check.
- Before every push, run `npx react-doctor@latest` and fix what it finds (tests, build and lint must pass too).
- Game logic that doesn't need rendering goes in `src/game/trace.ts` so it stays testable.
- Levels are JSON in `src/levels/<chapter>-<level>.json`, validated by the zod schema in `src/game/schema.ts`.
  Every new level must pass `npm test` (valid, solvable, not solved at start). Run `npm run levels:schema` after schema changes.
  Kit levels need a stored `solution`; build them in the sandbox (`#/sandbox`) and export.
- Piece geometry lives in `src/game/pieces.ts` and is shared by the tracer and `pieceMeshes.ts`; new pieces go in the
  schema, tracer, meshes, palette and inspector, plus a test in `trace.test.ts`.
- For any UI or motion work, follow the skills in `.claude/skills/` (start with `emil-design-eng`).
  Keep UI animations under 300ms, ease-out, never animate from scale(0), respect prefers-reduced-motion.
- Base UI components are meant to come from shadcn, added with the shadcn CLI, not written by hand.

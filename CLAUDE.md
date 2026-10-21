# LightRays

three.js laser optics puzzle. Vite + React 19 + TypeScript + Tailwind v4.

- `npm run dev` to play, `npm test` for the tracer and level solvability tests, `npm run build` to type-check.
- Game logic that doesn't need rendering goes in `src/game/trace.ts` so it stays testable.
- Levels are JSON in `src/levels/<chapter>-<level>.json`, validated by the zod schema in `src/game/schema.ts`.
  Every new level must pass `npm test` (valid, solvable, not solved at start). Run `npm run levels:schema` after schema changes.
- For any UI or motion work, follow the skills in `.claude/skills/` (start with `emil-design-eng`).
  Keep UI animations under 300ms, ease-out, never animate from scale(0), respect prefers-reduced-motion.
- Base UI components are meant to come from shadcn, added with the shadcn CLI, not written by hand.

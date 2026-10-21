import { z } from 'zod'

// Level files live in src/levels/*.json. Coordinates are board pixels (x right, y down),
// angles are degrees counter-clockwise on screen with 0° pointing right.

const point = { x: z.number(), y: z.number() }
const angle = z.number().min(0).lt(360)
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a #RRGGBB colour')

export const MirrorSchema = z.object({
  id: z.string().min(1),
  ...point,
  angle: angle.describe('Normal direction of the reflective face, in degrees'),
  fixed: z.boolean().optional().describe("Fixed mirrors can't be rotated by the player"),
  mustHit: z.boolean().optional().describe('The beam must bounce off this mirror to solve the level'),
})

export const WallSchema = z.object({ ...point, w: z.number().positive(), h: z.number().positive() })

export const LevelSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(1),
    id: z.string().regex(/^\d+-\d+$/, 'expected "<chapter>-<level>", e.g. "1-3"'),
    name: z.string().min(1),
    par: z.number().int().positive().describe('Fewest moves a tidy solution needs'),
    width: z.number().positive(),
    height: z.number().positive(),
    laser: z.object({ ...point, angle, color }),
    receiver: z.object({ ...point, r: z.number().positive() }),
    mirrors: z.array(MirrorSchema).min(1),
    walls: z.array(WallSchema),
  })
  .superRefine((level, ctx) => {
    const ids = new Set<string>()
    level.mirrors.forEach((m, i) => {
      if (ids.has(m.id)) ctx.addIssue({ code: 'custom', path: ['mirrors', i, 'id'], message: `duplicate mirror id "${m.id}"` })
      ids.add(m.id)
    })
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x <= level.width && y <= level.height
    const check = (x: number, y: number, path: (string | number)[]) => {
      if (!inside(x, y)) ctx.addIssue({ code: 'custom', path, message: 'outside the board' })
    }
    check(level.laser.x, level.laser.y, ['laser'])
    check(level.receiver.x, level.receiver.y, ['receiver'])
    level.mirrors.forEach((m, i) => check(m.x, m.y, ['mirrors', i]))
  })

export type LevelDef = z.infer<typeof LevelSchema>
export type MirrorDef = z.infer<typeof MirrorSchema>
export type WallDef = z.infer<typeof WallSchema>

/** Parses and validates a level from JSON text or an already-parsed object. Throws with readable messages. */
export function parseLevel(input: unknown): LevelDef {
  const data = typeof input === 'string' ? JSON.parse(input) : input
  const result = LevelSchema.safeParse(data)
  if (!result.success) throw new Error(`Invalid level:\n${z.prettifyError(result.error)}`)
  return result.data
}

/** Serialises a level back to the JSON file format, for export. */
export function serializeLevel(level: LevelDef): string {
  const { $schema: _ignored, ...rest } = level
  return JSON.stringify({ $schema: './level.schema.json', ...rest }, null, 2) + '\n'
}

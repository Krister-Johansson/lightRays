import { z } from 'zod'

// Level files live in src/levels/*.json. Coordinates are board pixels (x right, y down) and
// mark each piece's centre. Angles are degrees counter-clockwise on screen, 0° pointing right.

/** Beam colours as RGB bits, so filters and prisms can work on them with plain bit maths. */
export const COLOR_BITS = {
  red: 0b001,
  green: 0b010,
  blue: 0b100,
  yellow: 0b011,
  magenta: 0b101,
  cyan: 0b110,
  white: 0b111,
} as const

export type ColorName = keyof typeof COLOR_BITS
const colorName = z.enum(Object.keys(COLOR_BITS) as [ColorName, ...ColorName[]])

const angle = z.number().min(0).lt(360)

const base = {
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  angle: angle.default(0).describe('Degrees; for mirrors this is the direction the shiny face points'),
  lock: z
    .enum(['fixed', 'rotate', 'kit'])
    .default('fixed')
    .describe('fixed: part of the table. rotate: player can turn it. kit: starts in the tray, player places and turns it'),
  mustHit: z.boolean().optional().describe('A beam must touch this piece for the level to count as solved'),
  rotate: z.boolean().optional().describe('Player can turn it. Left out: true for "rotate" and "kit" pieces, false for "fixed"'),
  resize: z.boolean().optional().describe('Player can resize it in play. Left out: false'),
  scale: z.number().min(0.5).max(3).optional().describe('Size multiplier for optics (mirror length, prism size...). 1 when left out'),
}

export const PieceSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('laser'), color: colorName.default('yellow') }),
  z.object({ ...base, type: z.literal('mirror') }).describe('One shiny side; the back absorbs'),
  z.object({ ...base, type: z.literal('double-mirror') }).describe('Reflects on both faces'),
  z.object({ ...base, type: z.literal('splitter') }).describe('Half passes through, half reflects'),
  z.object({ ...base, type: z.literal('prism'), size: z.number().positive().default(90) }).describe('Refracts and splits mixed light into colours'),
  z
    .object({ ...base, type: z.literal('glass'), w: z.number().positive().default(100), h: z.number().positive().default(60) })
    .describe('Refracts: the beam leaves shifted but parallel'),
  z.object({ ...base, type: z.literal('filter'), color: colorName.default('red') }).describe('Only lets its colour through'),
  z.object({ ...base, type: z.literal('receiver'), color: colorName.optional() }).describe('Open receiver, lit from any side'),
  z
    .object({ ...base, type: z.literal('tube'), color: colorName.optional(), cone: z.number().positive().max(45).default(8) })
    .describe('Lit only by a beam entering the tube mouth within ±cone degrees'),
  z.object({ ...base, type: z.literal('wall'), w: z.number().positive().default(60), h: z.number().positive().default(60) }),
  z.object({ ...base, type: z.literal('retro') }).describe('Corner cube: sends a beam straight back, mirrored across its centre'),
  z
    .object({ ...base, type: z.literal('concave'), focal: z.number().positive().default(100) })
    .describe('Curved mirror: parallel beams meet at the focus, `focal` px in front'),
  z.object({ ...base, type: z.literal('dichroic'), color: colorName.default('blue') }).describe('Reflects its colour, lets the rest through'),
  z
    .object({ ...base, type: z.literal('grating'), spread: z.number().positive().max(80).default(25) })
    .describe('Splits a beam in three: straight on and ±spread degrees'),
  z.object({ ...base, type: z.literal('right-prism'), size: z.number().positive().default(70) }).describe('45-45-90 glass: turns a beam 90°, or U-turns it'),
  z.object({ ...base, type: z.literal('rhomboid'), length: z.number().positive().default(100) }).describe('Periscope in glass: shifts a beam sideways'),
  z.object({ ...base, type: z.literal('wedge') }).describe('Thin glass wedge: bends a beam by about 10°'),
  z.object({ ...base, type: z.literal('convex-lens'), focal: z.number().positive().default(150) }).describe('Bends beams toward its focus'),
  z.object({ ...base, type: z.literal('concave-lens'), focal: z.number().positive().default(150) }).describe('Spreads beams apart'),
  z
    .object({ ...base, type: z.literal('gate'), color: colorName.default('red'), w: z.number().positive().default(20), h: z.number().positive().default(100) })
    .describe('Colour gate: beams made only of its colour pass, anything else is blocked'),
  z
    .object({ ...base, type: z.literal('polariser'), axis: z.enum(['vertical', 'horizontal']).default('vertical') })
    .describe('Polarises light; blocks light polarised the other way'),
  z.object({ ...base, type: z.literal('waveplate') }).describe('Turns polarisation 90°'),
  z
    .object({ ...base, type: z.literal('scientist'), walk: z.number().min(0).max(800).default(0) })
    .describe('Test figure. The test fails if any beam touches it. Paces `walk` px along its angle and back'),
])

export type Piece = z.infer<typeof PieceSchema>
export type PieceType = Piece['type']
export type PieceOf<T extends PieceType> = Extract<Piece, { type: T }>

export const PlacementSchema = z.object({ x: z.number(), y: z.number(), angle, scale: z.number().min(0.5).max(3).optional() })
export type Placement = z.infer<typeof PlacementSchema>

export const LevelSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(2),
    id: z.string().regex(/^(\d+-\d+|sandbox)$/, 'expected "<chapter>-<level>", e.g. "1-3"'),
    name: z.string().min(1),
    par: z.number().int().nonnegative().describe('Fewest moves a tidy solution needs'),
    width: z.number().positive(),
    height: z.number().positive(),
    pieces: z.array(PieceSchema),
    solution: z
      .record(z.string(), PlacementSchema)
      .optional()
      .describe('Known-good placement for every non-fixed piece, used by tests and hints'),
  })
  .superRefine((level, ctx) => {
    const ids = new Set<string>()
    level.pieces.forEach((p, i) => {
      if (ids.has(p.id)) ctx.addIssue({ code: 'custom', path: ['pieces', i, 'id'], message: `duplicate piece id "${p.id}"` })
      ids.add(p.id)
      if (p.x < 0 || p.y < 0 || p.x > level.width || p.y > level.height) {
        ctx.addIssue({ code: 'custom', path: ['pieces', i], message: 'outside the board' })
      }
    })
    if (!level.pieces.some((p) => p.type === 'laser')) ctx.addIssue({ code: 'custom', path: ['pieces'], message: 'needs at least one laser' })
    for (const id of Object.keys(level.solution ?? {})) {
      if (!ids.has(id)) ctx.addIssue({ code: 'custom', path: ['solution', id], message: `no piece with id "${id}"` })
    }
  })

export type LevelDef = z.infer<typeof LevelSchema>

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

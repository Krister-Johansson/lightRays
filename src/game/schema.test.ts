import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import schemaFile from '../levels/level.schema.json'
import { LEVELS } from './levels'
import { LevelSchema, parseLevel, serializeLevel } from './schema'

describe('level files', () => {
  it('loads every level in order', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['1-1', '1-2', '1-3'])
  })

  it('round-trips through export and import', () => {
    for (const level of LEVELS) expect(parseLevel(serializeLevel(level))).toEqual({ ...level, $schema: './level.schema.json' })
  })

  it('rejects broken levels with a readable message', () => {
    const [first] = LEVELS[0].pieces
    expect(() => parseLevel({ ...LEVELS[0], pieces: [first, first] })).toThrow(/duplicate piece id/)
    expect(() => parseLevel({ ...LEVELS[0], pieces: [{ ...first, color: 'pink' }] })).toThrow(/pieces\[0\]\.color/)
  })

  it('keeps level.schema.json in sync with the zod schema (run npm run levels:schema)', () => {
    expect(schemaFile).toEqual(z.toJSONSchema(LevelSchema, { io: 'input', unrepresentable: 'any' }))
  })
})

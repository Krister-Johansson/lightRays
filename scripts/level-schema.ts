// Writes src/levels/level.schema.json from the zod schema, so editors autocomplete and
// validate level files. Run with: npm run levels:schema
import { writeFileSync } from 'node:fs'
import { z } from 'zod'
import { LevelSchema } from '../src/game/schema'

const schema = z.toJSONSchema(LevelSchema, { io: 'input', unrepresentable: 'any' })
writeFileSync(new URL('../src/levels/level.schema.json', import.meta.url), JSON.stringify(schema, null, 2) + '\n')
console.log('wrote src/levels/level.schema.json')

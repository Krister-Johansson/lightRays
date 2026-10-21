import { type LevelDef, parseLevel } from './schema'

// Every src/levels/<chapter>-<level>.json file is a level (level.schema.json is the editor schema). Drop a new file in to add one; play order
// follows the "<chapter>-<level>" id.
const files = import.meta.glob<unknown>('../levels/[0-9]*.json', { eager: true, import: 'default' })

function byId(a: LevelDef, b: LevelDef) {
  const [ac, al] = a.id.split('-').map(Number)
  const [bc, bl] = b.id.split('-').map(Number)
  return ac - bc || al - bl
}

export const LEVELS: LevelDef[] = Object.entries(files)
  .map(([path, data]) => {
    try {
      return parseLevel(data)
    } catch (e) {
      throw new Error(`${path}: ${(e as Error).message}`)
    }
  })
  .sort(byId)

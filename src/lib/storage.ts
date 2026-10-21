import { type LevelDef, parseLevel } from '../game/schema'

// Per-viewer conveniences only. Everything still works when storage is blocked.

const PROGRESS_KEY = 'lightrays.solved'
const SANDBOX_KEY = 'lightrays.sandbox'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable (private mode, blocked): progress just won't persist.
  }
}

export function loadSolved(): Set<string> {
  try {
    return new Set(JSON.parse(read(PROGRESS_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function markSolved(id: string) {
  const solved = loadSolved()
  solved.add(id)
  write(PROGRESS_KEY, JSON.stringify([...solved]))
}

export function loadSandbox(): LevelDef | null {
  const raw = read(SANDBOX_KEY)
  if (!raw) return null
  try {
    return parseLevel(raw)
  } catch {
    return null
  }
}

export function saveSandbox(level: LevelDef) {
  write(SANDBOX_KEY, JSON.stringify(level))
}

/** The level being test-played from the sandbox. Kept in memory: it only lives for one run. */
let testLevel: LevelDef | null = null
export const setTestLevel = (l: LevelDef) => {
  testLevel = l
}
export const getTestLevel = () => testLevel

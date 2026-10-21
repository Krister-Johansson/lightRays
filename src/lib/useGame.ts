import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Game, type GameSnapshot } from '../game/Game'

const noop = () => () => {}
const empty = () => null

/** Mounts a Game into the returned ref's element and subscribes to its snapshots. */
export function useGame() {
  const ref = useRef<HTMLDivElement>(null)
  const [game, setGame] = useState<Game | null>(null)
  useEffect(() => {
    const g = new Game(ref.current!)
    setGame(g)
    if (import.meta.env.DEV) Object.assign(window, { __game: g })
    return () => g.dispose()
  }, [])
  const snap: GameSnapshot | null = useSyncExternalStore(game?.subscribe ?? noop, game?.getSnapshot ?? empty)
  return { ref, game, snap }
}

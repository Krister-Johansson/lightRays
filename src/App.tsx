import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { DialOverlay } from './components/DialOverlay'
import { Hud } from './components/Hud'
import { KitTray } from './components/KitTray'
import { LevelComplete } from './components/LevelComplete'
import { Game, type GameSnapshot } from './game/Game'
import { LEVELS } from './game/levels'

const noop = () => () => {}
const empty = () => null

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [levelIndex, setLevelIndex] = useState(0)

  useEffect(() => {
    const g = new Game(hostRef.current!)
    setGame(g)
    if (import.meta.env.DEV) Object.assign(window, { __game: g })
    return () => g.dispose()
  }, [])

  useEffect(() => {
    game?.load(LEVELS[levelIndex])
  }, [game, levelIndex])

  const snap: GameSnapshot | null = useSyncExternalStore(game?.subscribe ?? noop, game?.getSnapshot ?? empty)
  const showWin = useSettledWin(snap)

  const goTo = (i: number) => setLevelIndex((i + LEVELS.length) % LEVELS.length)

  return (
    <div className="relative h-full w-full select-none">
      <div ref={hostRef} className="absolute inset-0" />
      {snap && (
        <>
          <Hud
            snap={snap}
            levelIndex={levelIndex}
            levelCount={LEVELS.length}
            onPrev={() => goTo(levelIndex - 1)}
            onNext={() => goTo(levelIndex + 1)}
            onReset={() => game?.reset()}
          />
          <DialOverlay dial={snap.dial} />
          <KitTray snap={snap} />
          {showWin && (
            <LevelComplete
              snap={snap}
              hasNext={levelIndex < LEVELS.length - 1}
              onNext={() => goTo(levelIndex + 1)}
              onReplay={() => game?.reset()}
            />
          )}
        </>
      )}
    </div>
  )
}

/**
 * Shows the win card only once the puzzle is solved and the player has let go,
 * after a short beat so the receiver's light-up pulse is seen first.
 */
function useSettledWin(snap: GameSnapshot | null) {
  const [show, setShow] = useState(false)
  const ready = !!snap && snap.solved && !snap.dragging
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setShow(true), 450)
    return () => {
      clearTimeout(t)
      setShow(false)
    }
  }, [ready, snap?.level])
  return show && ready
}

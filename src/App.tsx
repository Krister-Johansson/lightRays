import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { DialOverlay } from './components/DialOverlay'
import { FinishButton } from './components/FinishButton'
import { Hud } from './components/Hud'
import { KitTray } from './components/KitTray'
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
  const goTo = (i: number) => setLevelIndex((i + LEVELS.length) % LEVELS.length)
  const isLast = levelIndex === LEVELS.length - 1
  // After the last level, finishing loops back to the first.
  const finish = useCallback(() => setLevelIndex((i) => (i + 1) % LEVELS.length), [])

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
          <KitTray snap={snap}>
            <FinishButton unlocked={snap.unlocked} isLast={isLast} beam={snap.level.laser.color} onFinish={finish} />
          </KitTray>
        </>
      )}
    </div>
  )
}

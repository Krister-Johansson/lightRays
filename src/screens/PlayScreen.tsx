import { useCallback, useEffect } from 'react'
import { DialOverlay } from '../components/DialOverlay'
import { FinishButton } from '../components/FinishButton'
import { GameOverCard } from '../components/GameOverCard'
import { Hud } from '../components/Hud'
import { KitTray } from '../components/KitTray'
import { ZoomControls } from '../components/ZoomControls'
import { colorHex } from '../game/pieces'
import type { LevelDef } from '../game/schema'
import { useGame } from '../lib/useGame'

type Props = {
  level: LevelDef
  /** Where Finish round leads; null on the last level. */
  backLabel: string
  finishLabel: string
  onBack: () => void
  onFinish: () => void
  onSolved?: () => void
}

export function PlayScreen({ level, backLabel, finishLabel, onBack, onFinish, onSolved }: Props) {
  const { ref, game, snap } = useGame()

  useEffect(() => {
    game?.load(level, 'play')
  }, [game, level])

  const unlocked = !!snap?.unlocked && !snap.failed && snap.level === level
  useEffect(() => {
    if (unlocked) onSolved?.()
  }, [unlocked, onSolved])

  const finish = useCallback(() => onFinish(), [onFinish])
  const laser = level.pieces.find((p) => p.type === 'laser')
  const beamHex = colorHex(laser?.type === 'laser' ? laser.color : 'yellow')

  return (
    <div className="relative h-full w-full select-none">
      <div ref={ref} className="absolute inset-0" />
      {snap && game && (
        <>
          <Hud snap={snap} backLabel={backLabel} onBack={onBack} onReset={() => game.reset()} />
          <DialOverlay dial={snap.dial} />
          <ZoomControls game={game} zoom={snap.zoom} className="absolute top-[92px] right-4 sm:right-6" />
          {snap.gameOver && <GameOverCard onReset={() => game.reset()} />}
          <KitTray snap={snap} game={game}>
            <FinishButton unlocked={unlocked} label={finishLabel} beam={beamHex} onFinish={finish} />
          </KitTray>
        </>
      )}
    </div>
  )
}

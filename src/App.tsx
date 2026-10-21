import { useCallback, useEffect } from 'react'
import { LEVELS } from './game/levels'
import { go, useRoute } from './lib/route'
import { getTestLevel, markSolved } from './lib/storage'
import { LevelSelectScreen } from './screens/LevelSelectScreen'
import { MenuScreen } from './screens/MenuScreen'
import { PlayScreen } from './screens/PlayScreen'
import { SandboxScreen } from './screens/SandboxScreen'

export default function App() {
  const route = useRoute()
  switch (route.name) {
    case 'levels':
      return <LevelSelectScreen />
    case 'sandbox':
      return <SandboxScreen />
    case 'test': {
      const level = getTestLevel()
      if (!level) return <Redirect to="/sandbox" />
      return (
        <PlayScreen
          key="test"
          level={level}
          backLabel="Back to editor"
          finishLabel="Back to editor"
          onBack={() => go('/sandbox')}
          onFinish={() => go('/sandbox')}
        />
      )
    }
    case 'play':
      return <LevelRoute id={route.id} />
    default:
      return <MenuScreen />
  }
}

function LevelRoute({ id }: { id: string }) {
  const index = LEVELS.findIndex((l) => l.id === id)
  const level = LEVELS[index]
  const next = LEVELS[index + 1]
  const onSolved = useCallback(() => markSolved(id), [id])
  const onFinish = useCallback(() => go(next ? `/play/${next.id}` : '/levels'), [next])
  if (!level) return <Redirect to="/levels" />
  return (
    <PlayScreen
      key={level.id}
      level={level}
      backLabel="Back to levels"
      finishLabel={next ? 'Finish round' : 'Finish'}
      onBack={() => go('/levels')}
      onFinish={onFinish}
      onSolved={onSolved}
    />
  )
}

function Redirect({ to }: { to: string }) {
  useEffect(() => go(to), [to])
  return null
}

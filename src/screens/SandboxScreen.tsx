import { ChevronLeft, Download, Play, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, IconButton } from '../components/controls'
import { DialOverlay } from '../components/DialOverlay'
import { HelpPopover } from '../components/HelpPopover'
import { Inspector } from '../components/Inspector'
import { Palette } from '../components/Palette'
import { ZoomControls } from '../components/ZoomControls'
import { applyPlacements, toPlayable } from '../game/levelTools'
import { type LevelDef, parseLevel, serializeLevel } from '../game/schema'
import { go } from '../lib/route'
import { loadSandbox, saveSandbox, setTestLevel } from '../lib/storage'
import { useGame } from '../lib/useGame'

const STARTER: LevelDef = {
  version: 2,
  id: '2-1',
  name: 'My level',
  par: 2,
  width: 1120,
  height: 620,
  pieces: [
    { id: 'laser1', type: 'laser', x: 90, y: 310, angle: 0, lock: 'fixed', color: 'white' },
    { id: 'prism1', type: 'prism', x: 400, y: 310, angle: 90, lock: 'rotate', size: 90 },
    { id: 'receiver1', type: 'receiver', x: 980, y: 160, angle: 0, lock: 'fixed', color: 'red' },
    { id: 'wall1', type: 'wall', x: 700, y: 470, angle: 0, lock: 'fixed', w: 60, h: 180 },
  ],
}

type Meta = Pick<LevelDef, 'name' | 'id' | 'par'>

/** Sandbox / level editor: place every piece type, test play the result, import and export JSON. */
export function SandboxScreen() {
  const { ref, game, snap } = useGame()
  const [initial] = useState(() => loadSandbox() ?? STARTER)
  const [meta, setMeta] = useState<Meta>({ name: initial.name, id: initial.id, par: initial.par })
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!game) return
    game.setInsets(12, 12)
    game.load(initial, 'edit')
  }, [game, initial])

  // Autosave the board so a refresh or a test run never loses work.
  const pieces = snap?.pieces
  useEffect(() => {
    if (game && pieces) saveSandbox({ ...game.currentLevel(), ...meta })
  }, [game, pieces, meta])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(t)
  }, [notice])

  useEffect(() => {
    if (!confirmClear) return
    const t = setTimeout(() => setConfirmClear(false), 3000)
    return () => clearTimeout(t)
  }, [confirmClear])

  const playable = (): LevelDef | null => {
    if (!game) return null
    try {
      return parseLevel(toPlayable({ ...game.currentLevel(), ...meta }))
    } catch (e) {
      setNotice((e as Error).message.split('\n').slice(0, 2).join(' '))
      return null
    }
  }

  const testPlay = () => {
    const level = playable()
    if (!level) return
    setTestLevel({ ...level, id: 'sandbox' })
    go('/test')
  }

  const exportLevel = () => {
    const level = playable()
    if (!level) return
    const blob = new Blob([serializeLevel(level)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${meta.id || 'level'}.json`
    a.click()
    URL.revokeObjectURL(url)
    setNotice(`Exported ${a.download}. Drop it in src/levels to ship it.`)
  }

  const importLevel = async (file: File) => {
    if (!game) return
    try {
      const level = parseLevel(await file.text())
      // Show the solved arrangement so it can be edited and re-exported.
      const editable = { ...level, pieces: applyPlacements(level.pieces, level.solution ?? {}) }
      setMeta({ name: level.name, id: level.id, par: level.par })
      game.load(editable, 'edit')
      setNotice(`Imported ${level.name}.`)
    } catch (e) {
      setNotice((e as Error).message.split('\n').slice(0, 2).join(' '))
    }
  }

  return (
    <div className="flex h-full flex-col bg-ink select-none">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#1F2227] px-4">
        <IconButton label="Back to menu" onClick={() => go('/')}>
          <ChevronLeft className="size-5" aria-hidden />
        </IconButton>
        <h1 className="m-0 text-xl font-semibold">Sandbox</h1>
        <span className="hidden truncate text-sm text-muted md:inline">{meta.name}</span>
        <div className="flex-1" />
        <Button
          variant={confirmClear ? 'danger' : 'ghost'}
          onClick={() => {
            if (!confirmClear) return setConfirmClear(true)
            game?.clear()
            setConfirmClear(false)
          }}
        >
          <Trash2 className="size-4" aria-hidden /> {confirmClear ? 'Click again to clear' : 'Clear'}
        </Button>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" aria-hidden /> <span className="hidden sm:inline">Import</span>
        </Button>
        <Button onClick={exportLevel}>
          <Download className="size-4" aria-hidden /> <span className="hidden sm:inline">Export</span>
        </Button>
        <Button variant="primary" onClick={testPlay}>
          <Play className="size-4" aria-hidden /> Test play
        </Button>
        <HelpPopover />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importLevel(f)
            e.target.value = ''
          }}
        />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[212px] shrink-0 overflow-y-auto border-r border-[#1F2227] bg-panel-2 p-4 md:block">
          {game && <Palette game={game} />}
        </aside>
        <main className="relative min-w-0 flex-1">
          <div ref={ref} className="absolute inset-0" />
          {snap && <DialOverlay dial={snap.dial} />}
          {snap && game && <ZoomControls game={game} zoom={snap.zoom} className="absolute right-4 bottom-4" />}
          {notice && (
            <div role="status" className="enter-pop absolute bottom-4 left-1/2 max-w-[90%] -translate-x-1/2 rounded-xl border border-line-strong bg-card px-4 py-2.5 text-sm text-fg shadow-[0_12px_32px_rgb(0_0_0/0.45)]">
              {notice}
            </div>
          )}
        </main>
        <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-[#1F2227] bg-panel-2 p-5 lg:block">
          {game && snap && <Inspector snap={snap} game={game} meta={meta} onMeta={(patch) => setMeta((m) => ({ ...m, ...patch }))} />}
        </aside>
      </div>
    </div>
  )
}

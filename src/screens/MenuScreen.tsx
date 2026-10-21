import { LEVELS } from '../game/levels'
import { loadSolved } from '../lib/storage'

/** Landing page: the title, a hero beam bending through a mirror and a prism, and the menu. */
export function MenuScreen() {
  const solved = loadSolved()
  const next = LEVELS.find((l) => !solved.has(l.id)) ?? LEVELS[LEVELS.length - 1]
  const done = LEVELS.filter((l) => solved.has(l.id)).length

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      <HeroArt />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#0C0D0F_0%,rgb(12_13_15/0.85)_38%,transparent_70%)] lg:hidden" aria-hidden />
      <main className="relative flex h-full flex-col justify-center gap-7 px-6 sm:px-[120px]">
        <div className="enter-rise font-mono text-[13px] tracking-[3px] text-muted uppercase">An optics puzzle</div>
        <h1 className="enter-rise m-0 text-[clamp(72px,10vw,116px)] leading-[0.9] font-bold tracking-[-4px]" style={{ transitionDelay: '40ms' }}>
          Light
          <br />
          Rays
        </h1>
        <p className="enter-rise m-0 max-w-[440px] text-[19px] leading-normal text-muted" style={{ transitionDelay: '80ms' }}>
          Bend, split and colour laser beams with mirrors and prisms until every receiver lights up.
        </p>
        <nav aria-label="Main menu" className="enter-rise mt-3 flex w-[min(320px,100%)] flex-col gap-3" style={{ transitionDelay: '120ms' }}>
          <a
            href={`#/play/${next.id}`}
            className="pressable pressable-primary flex h-14 items-center justify-between rounded-[10px] bg-amber px-[22px] text-lg font-semibold text-amber-ink no-underline outline-none focus-visible:ring-2 focus-visible:ring-fg"
          >
            <span>{done === 0 ? 'Play' : 'Continue'}</span>
            <span className="font-mono text-[13px] font-medium">Level {next.id}</span>
          </a>
          <MenuLink href="#/levels">Level select</MenuLink>
          <MenuLink href="#/sandbox">Sandbox</MenuLink>
        </nav>
        <div className="enter-rise mt-4 flex items-center gap-4 font-mono text-[13px] text-muted" style={{ transitionDelay: '160ms' }}>
          <span>Chapter 1 · Reflection</span>
          <div className="h-1 w-40 rounded-sm bg-[#23272C]">
            <div className="h-1 rounded-sm bg-amber transition-[width] duration-300 ease-out" style={{ width: `${(done / LEVELS.length) * 100}%` }} />
          </div>
          <span>
            {done} / {LEVELS.length}
          </span>
        </div>
      </main>
    </div>
  )
}

function MenuLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      className="pressable flex h-[52px] items-center rounded-[10px] border border-line-strong bg-panel px-[22px] text-[17px] font-medium text-fg no-underline outline-none focus-visible:ring-2 focus-visible:ring-dial"
    >
      {children}
    </a>
  )
}

const FAN = [
  ['#FF5A4E', 300],
  ['#FFC940', 420],
  ['#45E08A', 540],
  ['#4FA8FF', 660],
] as const

function Beam({ d, color, glow = 14, core = 4 }: { d: string; color: string; glow?: number; core?: number }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={color} strokeWidth={glow} opacity="0.5" filter="url(#mglow)" />
      <path d={d} stroke={color} strokeWidth={core} filter="url(#mglow2)" />
      <path d={d} stroke="#FFFFFF" strokeWidth="1.4" />
    </g>
  )
}

/** The menu art from the design: a beam up into a mirror, across into a prism, fanning out. */
function HeroArt() {
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <filter id="mglow" filterUnits="userSpaceOnUse" x="0" y="0" width="1440" height="900">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="mglow2" filterUnits="userSpaceOnUse" x="0" y="0" width="1440" height="900">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <pattern id="mdots" width="32" height="32" patternUnits="userSpaceOnUse">
          <circle cx="16" cy="16" r="1.2" fill="#1F2227" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#mdots)" />
      <rect x="736" y="806" width="48" height="72" rx="8" fill="#17191C" stroke="#33373D" />
      <rect x="752" y="800" width="16" height="10" rx="2" fill="#2A2E34" />
      <g className="hero-beam">
        <Beam d="M760 802 V470 H948" color="#FFF4D6" />
      </g>
      <line x1="728" y1="502" x2="792" y2="438" stroke="#2C3036" strokeWidth="10" strokeLinecap="round" />
      <line x1="732" y1="494" x2="788" y2="438" stroke="#C9CDD3" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <polygon points="900,560 1080,560 990,404" fill="#15181C" fillOpacity="0.85" stroke="#4A5058" strokeWidth="1.5" />
      <line x1="948" y1="470" x2="1028" y2="478" stroke="#FFFFFF" strokeWidth="2" opacity="0.35" />
      <g className="hero-fan">
        {FAN.map(([color, y], i) => (
          <g key={color} fill="none" strokeLinecap="round">
            <line x1={1030 + i * 2} y1={476 + i * 4} x2="1440" y2={y} stroke={color} strokeWidth="12" opacity="0.5" filter="url(#mglow)" />
            <line x1={1030 + i * 2} y1={476 + i * 4} x2="1440" y2={y} stroke={color} strokeWidth="2.5" />
          </g>
        ))}
      </g>
    </svg>
  )
}

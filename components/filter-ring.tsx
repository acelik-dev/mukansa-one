'use client'

import type { RingTone } from '@/lib/calc'

interface Props {
  percent: number
  tone: RingTone
  remainingDays: number
  size?: number
  onClick?: () => void
}

const TONE_COLOR: Record<RingTone, { main: string; soft: string }> = {
  ok: { main: '#7fd4e4', soft: '#2e7d8c' },
  warning: { main: '#e0a34a', soft: '#a9702a' },
  danger: { main: '#e05a4a', soft: '#a33328' },
}

export function FilterRing({
  percent,
  tone,
  remainingDays,
  size = 260,
  onClick,
}: Props) {
  const c = size / 2
  const arcR = c - 8
  const circ = 2 * Math.PI * arcR
  const offset = circ * (1 - percent / 100)
  const color = TONE_COLOR[tone]

  const waterR = c - 30
  const waterTop = c - waterR
  const level = c + waterR - (percent / 100) * (2 * waterR)
  const clampedLevel = Math.max(waterTop, Math.min(c + waterR, level))

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Filtre ömrü yüzde ${Math.round(percent)}, ${remainingDays} gün kaldı`}
      className="relative outline-none"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color.main} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color.soft} stopOpacity="0.95" />
          </linearGradient>
          <clipPath id="waterClip">
            <circle cx={c} cy={c} r={waterR} />
          </clipPath>
        </defs>

        {/* iç kuyu zemini */}
        <circle cx={c} cy={c} r={waterR} fill="#0a1519" />

        {/* animasyonlu su dolgusu */}
        <g clipPath="url(#waterClip)">
          <g
            style={{
              transform: `translateY(${clampedLevel - waterTop}px)`,
              transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <g
              style={{
                animation: 'wave-drift 6s linear infinite',
                transformOrigin: 'center',
              }}
            >
              <WaveBody cx={c} width={size} top={waterTop} bottom={size} />
            </g>
            <g
              style={{
                animation: 'wave-drift 9s linear infinite reverse',
                opacity: 0.5,
              }}
            >
              <WaveBody cx={c} width={size} top={waterTop} bottom={size} />
            </g>
          </g>
        </g>

        {/* zemin ring */}
        <circle
          cx={c}
          cy={c}
          r={arcR}
          fill="none"
          stroke="#24363f"
          strokeWidth={6}
        />
        {/* ilerleme arkı */}
        <circle
          cx={c}
          cy={c}
          r={arcR}
          fill="none"
          stroke={color.main}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${c} ${c})`}
          style={{
            transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1), stroke 0.5s ease',
            filter: `drop-shadow(0 0 6px ${color.main}66)`,
          }}
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl font-semibold tabular text-foreground">
          {remainingDays}
        </span>
        <span className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          gün kaldı
        </span>
        <span
          className="mt-3 rounded-full px-3 py-0.5 text-xs font-medium tabular"
          style={{ background: `${color.main}1a`, color: color.main }}
        >
          %{Math.round(percent)} ömür
        </span>
      </div>
    </button>
  )
}

/** Tekrarlanan sinüs dalgası — yatay kaydırıldığında kesintisiz döner */
function WaveBody({
  cx,
  width,
  top,
  bottom,
}: {
  cx: number
  width: number
  top: number
  bottom: number
}) {
  const amp = 6
  const w = width
  // iki periyot: 0..2w, x=w'da kesintisiz döngü
  const d = `
    M ${-w} ${top}
    q ${w / 4} ${-amp} ${w / 2} 0
    t ${w / 2} 0
    t ${w / 2} 0
    t ${w / 2} 0
    t ${w / 2} 0
    t ${w / 2} 0
    L ${cx + w * 1.5} ${bottom}
    L ${-w} ${bottom}
    Z
  `
  return <path d={d} fill="url(#waterGrad)" />
}

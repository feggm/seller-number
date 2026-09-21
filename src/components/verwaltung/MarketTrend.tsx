import type {
  MarketStats,
  NumberMarket,
  PermanentNumber,
} from '@/clients/admin/useRegisterQueries'
import { marketKey } from '@/clients/admin/useRegisterQueries'
import { useState } from 'react'

import { euro } from './figures'

const MARKETS_SHOWN = 8

// Two series, validated pair from the reference palette (scripts/validate_palette.js:
// CVD ΔE 24.7, normal ΔE 33.6, contrast ≥ 3:1). The median is dashed as well, so the pair is
// never told apart by colour alone.
const SERIES_NUMBER = '#2a78d6'
const SERIES_MEDIAN = '#eb6834'
const INK = '#0b0b0b'
const INK_SECONDARY = '#52514e'
const GRID = '#e5e5e2'

type Point = { market: string; value: number | null; match?: NumberMarket['holderMatch'] }

/**
 * The number's last eight markets against the market median — one small chart per measure
 * (items, revenue), one axis each. The line connects only the markets the current holder
 * sold; another person's market is a hollow marker, off the line.
 */
export function MarketTrend({
  number,
  rows,
  stats,
}: {
  number: PermanentNumber
  rows: NumberMarket[]
  stats: MarketStats[]
}) {
  const markets = [...stats]
    .sort((a, b) => marketKey(a.market).localeCompare(marketKey(b.market)))
    .slice(-MARKETS_SHOWN)
  const own = new Map(rows.filter((r) => r.permanentNumber === number.id).map((r) => [r.market, r]))
  if (markets.length === 0 || own.size === 0) return null

  const series = (pick: (r: NumberMarket) => number, median: (s: MarketStats) => number | null) => ({
    number: markets.map((s): Point => {
      const r = own.get(s.market)
      return r ? { market: s.market, value: pick(r), match: r.holderMatch } : { market: s.market, value: null }
    }),
    median: markets.map((s): Point => ({ market: s.market, value: median(s) })),
  })

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Chart
        title="Teile"
        {...series((r) => r.itemsSold, (s) => s.itemsMedian)}
        format={(v) => String(Math.round(v))}
        holderId={number.holder}
      />
      <Chart
        title="Umsatz"
        {...series((r) => r.revenueCents, (s) => s.revenueCentsMedian)}
        format={(v) => euro(Math.round(v))}
        holderId={number.holder}
      />
    </div>
  )
}

function Chart({
  title,
  number,
  median,
  format,
}: {
  title: string
  number: Point[]
  median: Point[]
  format: (v: number) => string
  holderId: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const width = 420
  const height = 180
  const pad = { top: 12, right: 30, bottom: 28, left: 52 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const values = [...number, ...median].map((p) => p.value).filter((v): v is number => v !== null)
  const max = Math.max(1, ...values) * 1.1
  const x = (i: number) => pad.left + (number.length === 1 ? innerW / 2 : (i / (number.length - 1)) * innerW)
  const y = (v: number) => pad.top + innerH - (v / max) * innerH
  const ticks = [0, 0.5, 1].map((f) => f * max)

  // The line only connects markets the current holder sold; a gap breaks it.
  const segments: string[] = []
  let current: string[] = []
  number.forEach((p, i) => {
    if (p.value !== null && p.match === 'holder') {
      current.push(`${String(x(i))},${String(y(p.value))}`)
    } else if (current.length) {
      segments.push(current.join(' '))
      current = []
    }
  })
  if (current.length) segments.push(current.join(' '))
  const medianPath = median
    .map((p, i) => (p.value === null ? null : `${String(x(i))},${String(y(p.value))}`))
    .filter((s): s is string => s !== null)
    .join(' ')

  const hovered = hover === null ? null : { own: number[hover], med: median[hover] }

  return (
    <figure className="m-0">
      <figcaption className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold" style={{ color: INK }}>{title}</span>
        <span className="flex gap-3" style={{ color: INK_SECONDARY }}>
          <span className="flex items-center gap-1">
            <svg width="18" height="8" aria-hidden><line x1="0" y1="4" x2="18" y2="4" stroke={SERIES_NUMBER} strokeWidth="2" /><circle cx="9" cy="4" r="3" fill={SERIES_NUMBER} /></svg>
            diese Nummer
          </span>
          <span className="flex items-center gap-1">
            <svg width="18" height="8" aria-hidden><line x1="0" y1="4" x2="18" y2="4" stroke={SERIES_MEDIAN} strokeWidth="2" strokeDasharray="4 3" /></svg>
            Markt-Median
          </span>
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="w-full"
        role="img"
        aria-label={`${title}: diese Nummer gegen den Markt-Median über ${String(number.length)} Märkte`}
        onMouseLeave={() => { setHover(null); }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={pad.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill={INK_SECONDARY}>
              {format(t)}
            </text>
          </g>
        ))}
        {number.map((p, i) => (
          <text key={p.market} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill={INK_SECONDARY}>
            {p.market.replace('-', ' ')}
          </text>
        ))}
        <polyline points={medianPath} fill="none" stroke={SERIES_MEDIAN} strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" />
        {segments.map((s) => (
          <polyline key={s} points={s} fill="none" stroke={SERIES_NUMBER} strokeWidth="2" strokeLinejoin="round" />
        ))}
        {number.map((p, i) =>
          p.value === null ? null : (
            <circle
              key={p.market}
              cx={x(i)}
              cy={y(p.value)}
              r={hover === i ? 5 : 4}
              fill={p.match === 'holder' ? SERIES_NUMBER : '#fcfcfb'}
              stroke={SERIES_NUMBER}
              strokeWidth="2"
            >
              <title>
                {p.market}: {format(p.value)}
                {p.match !== 'holder' ? ' — andere Person' : ''}
              </title>
            </circle>
          )
        )}
        {/* hit targets, wider than the marks */}
        {number.map((p, i) => (
          <rect
            key={`hit-${p.market}`}
            x={x(i) - innerW / number.length / 2}
            y={pad.top}
            width={innerW / number.length}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => { setHover(i); }}
          />
        ))}
        {hovered && (
          <g pointerEvents="none">
            <line x1={x(hover ?? 0)} x2={x(hover ?? 0)} y1={pad.top} y2={pad.top + innerH} stroke={INK_SECONDARY} strokeWidth="1" strokeDasharray="2 2" />
            <g transform={`translate(${String(Math.min(x(hover ?? 0) + 8, width - 150))}, ${String(pad.top + 4)})`}>
              <rect width="142" height="44" rx="4" fill="#fcfcfb" stroke={GRID} />
              <text x="6" y="14" fontSize="10" fontWeight="600" fill={INK}>{hovered.own.market}</text>
              <text x="6" y="27" fontSize="10" fill={INK}>
                Nummer: {hovered.own.value === null ? '—' : format(hovered.own.value)}
                {hovered.own.match && hovered.own.match !== 'holder' ? ' (andere Person)' : ''}
              </text>
              <text x="6" y="39" fontSize="10" fill={INK}>
                Median: {hovered.med.value === null ? '—' : format(hovered.med.value)}
              </text>
            </g>
          </g>
        )}
      </svg>
    </figure>
  )
}

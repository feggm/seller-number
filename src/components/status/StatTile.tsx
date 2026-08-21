import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'

const compactFormatter = new Intl.NumberFormat('de-DE')

/**
 * Status colours are reserved for state — good / warning / serious / critical — and never
 * reused as a series colour. They also never carry meaning on their own: every status here
 * ships with an icon *and* a word, so the tile is readable in greyscale, in forced-colors
 * mode, and for anyone who cannot separate the two hues.
 *
 * Two inks per status: the large value can use the 3:1 step (large text only needs 3:1), the
 * small caption needs the darker 4.5:1 step.
 */
const STATUS = {
  good: {
    value: '#0ca30c',
    caption: '#006300',
    border: 'border-green-200',
    surface: 'bg-green-50/60',
    Icon: CheckCircle2,
  },
  critical: {
    value: '#d03b3b',
    caption: '#d03b3b',
    border: 'border-red-200',
    surface: 'bg-red-50/60',
    Icon: AlertCircle,
  },
  pending: {
    value: '#52514e',
    caption: '#52514e',
    border: 'border-slate-200',
    surface: 'bg-slate-50/60',
    Icon: Clock,
  },
} as const

export type StatStatus = keyof typeof STATUS

/**
 * A single headline figure. Deliberately not a chart: a one-bar bar chart for a scalar is an
 * anti-pattern, and these four numbers are read, not compared visually.
 *
 * `accent` paints only the small dot beside the label — a categorical hue is illegible as text
 * on a light surface, so it never touches the value.
 */
export const StatTile = ({
  label,
  value,
  hint,
  accent,
  muted,
  status,
  statusLabel,
}: {
  label: string
  value: number | string
  hint?: string
  accent?: string
  muted?: boolean
  status?: StatStatus
  statusLabel?: string
}) => {
  const tone = status ? STATUS[status] : undefined
  const Icon = tone?.Icon

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-lg border px-4 py-3',
        tone ? `${tone.border} ${tone.surface}` : 'border-slate-200 bg-white/60'
      )}
    >
      <div className="flex items-center gap-2">
        {accent && (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>

      <span
        className={cn(
          'text-2xl font-semibold tabular-nums',
          !tone && (muted ? 'text-slate-400' : 'text-slate-900')
        )}
        style={tone ? { color: tone.value } : undefined}
      >
        {typeof value === 'number' ? compactFormatter.format(value) : value}
      </span>

      {tone && statusLabel && (
        <span
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: tone.caption }}
        >
          {Icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
          {statusLabel}
        </span>
      )}

      {hint && <span className="text-xs leading-snug text-slate-400">{hint}</span>}
    </div>
  )
}

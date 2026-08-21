import { cn } from '@/lib/utils'

const compactFormatter = new Intl.NumberFormat('de-DE')

/**
 * A single headline figure. Deliberately not a chart: a one-bar bar chart for a scalar is an
 * anti-pattern, and these four numbers are read, not compared visually.
 *
 * `accent` paints only the small dot beside the label — the value itself stays in ink, because
 * a categorical hue is illegible as text on a light surface.
 */
export const StatTile = ({
  label,
  value,
  hint,
  accent,
  muted,
}: {
  label: string
  value: number | string
  hint?: string
  accent?: string
  muted?: boolean
}) => (
  <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/60 px-4 py-3">
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
        muted ? 'text-slate-400' : 'text-slate-900'
      )}
    >
      {typeof value === 'number' ? compactFormatter.format(value) : value}
    </span>
    {hint && <span className="text-xs leading-snug text-slate-400">{hint}</span>}
  </div>
)

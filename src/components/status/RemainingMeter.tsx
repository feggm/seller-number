const numberFormatter = new Intl.NumberFormat('de-DE')

/**
 * "Noch X von Y frei" as a meter — one ratio against a known limit, which is exactly what a
 * meter is for. Not a two-slice pie, and not a traffic light: status colours (green/amber/red)
 * mean good/warning/critical and must never stand in for "how full is this".
 *
 * The track is a lighter step of the same blue ramp as the fill, so the state reads across the
 * whole bar rather than only where it happens to be filled.
 */
export const RemainingMeter = ({
  total,
  taken,
  fill = '#2a78d6',
  track = '#d6e6f9',
}: {
  total: number
  taken: number
  fill?: string
  track?: string
}) => {
  const safeTotal = Math.max(total, 0)
  const safeTaken = Math.min(Math.max(taken, 0), safeTotal)
  const remaining = safeTotal - safeTaken
  const ratio = safeTotal === 0 ? 0 : safeTaken / safeTotal

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-slate-600">
          Noch{' '}
          <span className="font-semibold tabular-nums text-slate-900">
            {numberFormatter.format(remaining)}
          </span>{' '}
          von {numberFormatter.format(safeTotal)} Nummern frei
        </span>
        <span className="text-xs tabular-nums text-slate-400">
          {Math.round(ratio * 100)} % vergeben
        </span>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: track }}
        role="meter"
        aria-valuenow={safeTaken}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-label={`${numberFormatter.format(safeTaken)} von ${numberFormatter.format(
          safeTotal
        )} Nummern vergeben`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${(ratio * 100).toString()}%`, backgroundColor: fill }}
        />
      </div>
    </div>
  )
}

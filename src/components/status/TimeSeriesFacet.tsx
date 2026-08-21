import { useRef } from 'react'

import {
  type Point,
  areaPath,
  formatClock,
  linePath,
  linearScale,
  niceTicks,
  stepPath,
  timeTicks,
} from './scale'

const VIEW_WIDTH = 800
const PAD = { top: 12, right: 16, bottom: 22, left: 44 }

const numberFormatter = new Intl.NumberFormat('de-DE')

/**
 * One single-series time plot.
 *
 * Two of these are stacked sharing an x-axis rather than combined into one plot with two
 * y-scales. A dual-axis chart invents a correlation, because where the two scales line up is
 * arbitrary — and here it would also paper over the fact that the two series have different
 * resolutions (registrations are exact, connections are 5s samples).
 *
 * No legend: a single series is named by the facet's own title.
 *
 * Sizing is done with a fixed viewBox scaled to the container width, so there is no
 * ResizeObserver fighting the 2s refetch. Hairlines carry `non-scaling-stroke` to stay crisp.
 */
export const TimeSeriesFacet = ({
  title,
  subtitle,
  points,
  domain,
  yMax,
  color,
  mode = 'area',
  height = 170,
  referenceValue,
  referenceLabel,
  showXAxis = false,
  hoverT,
  onHoverT,
}: {
  title: string
  subtitle?: string
  points: Point[]
  domain: [number, number]
  yMax: number
  color: string
  mode?: 'area' | 'step'
  height?: number
  referenceValue?: number
  referenceLabel?: string
  showXAxis?: boolean
  hoverT?: number
  onHoverT?: (t: number | undefined) => void
}) => {
  const svgRef = useRef<SVGSVGElement>(null)

  const plotTop = PAD.top
  const plotBottom = height - PAD.bottom
  const plotLeft = PAD.left
  const plotRight = VIEW_WIDTH - PAD.right

  const safeMax = yMax > 0 ? yMax : 1
  const x = linearScale(domain, [plotLeft, plotRight])
  const y = linearScale([0, safeMax], [plotBottom, plotTop])

  const yTicks = niceTicks(0, safeMax, 3)
  const xTicks = timeTicks(domain[0], domain[1], 4)

  const handlePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!onHoverT) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return

    const viewX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    if (viewX < plotLeft || viewX > plotRight) {
      onHoverT(undefined)
      return
    }

    const ratio = (viewX - plotLeft) / (plotRight - plotLeft)
    onHoverT(domain[0] + ratio * (domain[1] - domain[0]))
  }

  const hoverX =
    hoverT !== undefined && hoverT >= domain[0] && hoverT <= domain[1]
      ? x(hoverT)
      : undefined

  return (
    <figure className="m-0 flex flex-col gap-1">
      <figcaption className="flex items-baseline gap-2">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-medium text-slate-700">{title}</span>
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </figcaption>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH.toString()} ${height.toString()}`}
        className="w-full touch-none"
        style={{ height: 'auto' }}
        role="img"
        aria-label={title}
        onPointerMove={handlePointer}
        onPointerLeave={() => onHoverT?.(undefined)}
      >
        {/* gridlines — recessive, solid hairlines, never dashed */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={plotLeft}
              x2={plotRight}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e2e8f0"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={plotLeft - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-slate-400"
              style={{ fontSize: 11 }}
            >
              {numberFormatter.format(tick)}
            </text>
          </g>
        ))}

        {/* the ceiling, when there is a known total */}
        {referenceValue !== undefined && referenceValue <= safeMax && (
          <g>
            <line
              x1={plotLeft}
              x2={plotRight}
              y1={y(referenceValue)}
              y2={y(referenceValue)}
              stroke="#94a3b8"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {referenceLabel && (
              <text
                x={plotRight}
                y={y(referenceValue) - 5}
                textAnchor="end"
                className="fill-slate-400"
                style={{ fontSize: 10 }}
              >
                {referenceLabel}
              </text>
            )}
          </g>
        )}

        {points.length > 0 && (
          <>
            {mode === 'area' && (
              <path
                d={areaPath(points, x, y, plotBottom)}
                fill={color}
                fillOpacity={0.1}
              />
            )}
            <path
              d={mode === 'step' ? stepPath(points, x, y) : linePath(points, x, y)}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {/* end marker, with a surface ring so it stays legible over the line */}
            <circle
              cx={x(points[points.length - 1].t)}
              cy={y(points[points.length - 1].v)}
              r={4}
              fill={color}
              stroke="#ffffff"
              strokeWidth={2}
            />
          </>
        )}

        {hoverX !== undefined && (
          <line
            x1={hoverX}
            x2={hoverX}
            y1={plotTop}
            y2={plotBottom}
            stroke="#94a3b8"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* baseline */}
        <line
          x1={plotLeft}
          x2={plotRight}
          y1={plotBottom}
          y2={plotBottom}
          stroke="#cbd5e1"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />

        {showXAxis &&
          xTicks.map((tick) => (
            <text
              key={tick}
              x={x(tick)}
              y={plotBottom + 14}
              textAnchor="middle"
              className="fill-slate-400"
              style={{ fontSize: 11 }}
            >
              {formatClock(tick)}
            </text>
          ))}
      </svg>
    </figure>
  )
}

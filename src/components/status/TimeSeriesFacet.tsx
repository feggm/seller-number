import { useEffect, useRef } from 'react'

import {
  type Point,
  areaPath,
  formatAxisTime,
  linePath,
  linearScale,
  niceTicks,
  stepPath,
  timeTicks,
} from './scale'

const VIEW_WIDTH = 800
const PAD = { top: 12, right: 16, bottom: 22, left: 44 }

/** Never zoom in past this — the connection samples are 5s buckets, so beyond a certain
 *  point there is nothing more to reveal, only empty space between the same points. */
export const MIN_SPAN_MS = 30_000

const numberFormatter = new Intl.NumberFormat('de-DE')

export type Viewport = { from: number; to: number }

/**
 * One single-series time plot, pannable and zoomable.
 *
 * Two of these are stacked sharing an x-axis rather than combined into one plot with two
 * y-scales. A dual-axis chart invents a correlation, because where the two scales line up is
 * arbitrary — and here it would also paper over the fact that the two series have different
 * resolutions (registrations are exact, connections are 5s samples).
 *
 * No legend: a single series is named by the facet's own title.
 *
 * Sizing uses a fixed viewBox scaled to the container width, so there is no ResizeObserver
 * fighting the 2s refetch. Hairlines carry `non-scaling-stroke` to stay crisp.
 *
 * Interaction: wheel zooms around the cursor, drag pans, two fingers pinch. All of it is
 * arithmetic on the visible domain — the parent owns that state so both facets move together,
 * and everything stays inside `bounds`, the window actually loaded from the server.
 */
export const TimeSeriesFacet = ({
  title,
  subtitle,
  points,
  domain,
  bounds,
  yMax,
  color,
  mode = 'area',
  height = 170,
  referenceValue,
  referenceLabel,
  showXAxis = false,
  dimmed = false,
  hoverT,
  onHoverT,
  onViewportChange,
}: {
  title: string
  subtitle?: string
  points: Point[]
  domain: [number, number]
  bounds: [number, number]
  yMax: number
  color: string
  mode?: 'area' | 'step'
  height?: number
  referenceValue?: number
  referenceLabel?: string
  showXAxis?: boolean
  dimmed?: boolean
  hoverT?: number
  onHoverT?: (t: number | undefined) => void
  /** Receives an updater, not a value: rapid wheel events are batched by React, so each one
   *  must compose on the previous viewport rather than on the domain from the last render. */
  onViewportChange?: (update: (current: Viewport) => Viewport) => void
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  // Active pointers, so one finger pans and two pinch.
  const pointersRef = useRef(new Map<number, { x: number; t: number }>())
  const pinchRef = useRef<{ distance: number; span: number; centerT: number } | null>(null)
  const draggedRef = useRef(false)

  const plotTop = PAD.top
  const plotBottom = height - PAD.bottom
  const plotLeft = PAD.left
  const plotRight = VIEW_WIDTH - PAD.right
  const plotWidth = plotRight - plotLeft

  const safeMax = yMax > 0 ? yMax : 1
  const x = linearScale(domain, [plotLeft, plotRight])
  const y = linearScale([0, safeMax], [plotBottom, plotTop])

  const yTicks = niceTicks(0, safeMax, 3)
  const xTicks = timeTicks(domain[0], domain[1], 4)

  /** Client px → viewBox x. */
  const toViewX = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return undefined
    return ((clientX - rect.left) / rect.width) * VIEW_WIDTH
  }

  /** Keeps a proposed viewport inside the loaded window, preserving its span where possible. */
  const clampViewport = (from: number, to: number): Viewport => {
    const maxSpan = bounds[1] - bounds[0]
    let span = Math.min(Math.max(to - from, MIN_SPAN_MS), maxSpan)
    if (span <= 0) span = maxSpan

    let start = from
    if (start < bounds[0]) start = bounds[0]
    if (start + span > bounds[1]) start = bounds[1] - span

    return { from: start, to: start + span }
  }

  const onWheelRef = useRef<(event: WheelEvent) => void>(() => undefined)
  onWheelRef.current = (event: WheelEvent) => {
    if (!onViewportChange) return
    const viewX = toViewX(event.clientX)
    if (viewX === undefined) return

    event.preventDefault()

    // Anchor on the instant under the cursor so zooming feels like it grabs the data.
    const ratio = Math.min(Math.max((viewX - plotLeft) / plotWidth, 0), 1)

    onViewportChange((current) => {
      const currentSpan = current.to - current.from
      const currentAnchor = current.from + ratio * currentSpan
      const span_ = currentSpan * Math.exp(event.deltaY * 0.002)
      return clampViewport(currentAnchor - ratio * span_, currentAnchor - ratio * span_ + span_)
    })
  }

  // React registers onWheel passively, where preventDefault() is ignored — the page would
  // scroll while the chart zooms. A native non-passive listener is the only way to own the
  // gesture. The handler is read through a ref so this binds once and still sees fresh state.
  useEffect(() => {
    const node = svgRef.current
    if (!node) return
    const listener = (event: WheelEvent) => {
      onWheelRef.current(event)
    }
    node.addEventListener('wheel', listener, { passive: false })
    return () => {
      node.removeEventListener('wheel', listener)
    }
  }, [])

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!onViewportChange) return
    const viewX = toViewX(event.clientX)
    if (viewX === undefined) return

    draggedRef.current = false
    pointersRef.current.set(event.pointerId, {
      x: viewX,
      t: domain[0] + ((viewX - plotLeft) / plotWidth) * (domain[1] - domain[0]),
    })
    svgRef.current?.setPointerCapture(event.pointerId)

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      pinchRef.current = {
        distance: Math.abs(a.x - b.x) || 1,
        span: domain[1] - domain[0],
        centerT: (a.t + b.t) / 2,
      }
    }
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const viewX = toViewX(event.clientX)
    if (viewX === undefined) return

    const tracked = pointersRef.current.get(event.pointerId)

    // --- pinch: two fingers, zoom about their midpoint ---
    if (tracked && pointersRef.current.size === 2 && pinchRef.current && onViewportChange) {
      tracked.x = viewX
      const [a, b] = [...pointersRef.current.values()]
      const distance = Math.abs(a.x - b.x) || 1
      const nextSpan = pinchRef.current.span * (pinchRef.current.distance / distance)
      const center = pinchRef.current.centerT
      draggedRef.current = true
      // Pinch is absolute (measured from the gesture's start), so it does not compose.
      onViewportChange(() => clampViewport(center - nextSpan / 2, center + nextSpan / 2))
      return
    }

    // --- drag: one pointer, pan ---
    if (tracked && onViewportChange) {
      const movedBy = viewX - tracked.x
      tracked.x = viewX
      if (Math.abs(movedBy) > 1) draggedRef.current = true
      onViewportChange((current) => {
        const deltaT = (movedBy / plotWidth) * (current.to - current.from)
        return clampViewport(current.from - deltaT, current.to - deltaT)
      })
      return
    }

    // --- hover: crosshair ---
    if (!onHoverT) return
    if (viewX < plotLeft || viewX > plotRight) {
      onHoverT(undefined)
      return
    }
    const ratio = (viewX - plotLeft) / plotWidth
    onHoverT(domain[0] + ratio * (domain[1] - domain[0]))
  }

  const endPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0 && draggedRef.current) onHoverT?.(undefined)
  }

  const hoverX =
    hoverT !== undefined && hoverT >= domain[0] && hoverT <= domain[1] ? x(hoverT) : undefined

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
        className={
          'w-full touch-none select-none transition-opacity duration-200 ' +
          (onViewportChange ? 'cursor-grab active:cursor-grabbing ' : '') +
          (dimmed ? 'opacity-40' : 'opacity-100')
        }
        style={{ height: 'auto' }}
        role="img"
        aria-label={title}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={(event) => {
          endPointer(event)
          onHoverT?.(undefined)
        }}
      >
        {/* clip so panned marks never spill into the padding or over the axis labels */}
        <defs>
          <clipPath id={`clip-${title.replace(/\W/g, '')}`}>
            <rect
              x={plotLeft}
              y={plotTop}
              width={plotWidth}
              height={plotBottom - plotTop}
            />
          </clipPath>
        </defs>

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

        <g clipPath={`url(#clip-${title.replace(/\W/g, '')})`}>
          {points.length > 0 && (
            <>
              {mode === 'area' && (
                <path d={areaPath(points, x, y, plotBottom)} fill={color} fillOpacity={0.1} />
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
        </g>

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
          xTicks.map((tick, index) => (
            <text
              key={tick}
              x={x(tick)}
              y={plotBottom + 14}
              // The outermost labels sit exactly on the plot edges; centring them there would
              // push half the text outside the viewBox and clip it.
              textAnchor={
                index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'
              }
              className="fill-slate-400"
              style={{ fontSize: 11 }}
            >
              {formatAxisTime(tick, domain[1] - domain[0])}
            </text>
          ))}
      </svg>
    </figure>
  )
}

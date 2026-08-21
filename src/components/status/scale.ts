/**
 * Minimal linear scales and path builders for the status page's two time-series facets.
 *
 * Hand-rolled rather than a charting dependency on purpose: the entry chunk is already over
 * the 500 kB warning threshold, and this page's whole job is to be up instantly during a rush
 * over a Cloudflare→Uberspace path that is documented as the latency bottleneck. Two
 * single-series plots with a known y-max do not justify ~100 kB gzip.
 */

export type Point = { t: number; v: number }

export type Scale = (value: number) => number

export const linearScale = (
  [d0, d1]: [number, number],
  [r0, r1]: [number, number]
): Scale => {
  const span = d1 - d0
  if (span === 0) return () => r0
  return (value) => r0 + ((value - d0) / span) * (r1 - r0)
}

/** Rounded tick values across [min, max] — at most `count` of them, on 1/2/5×10ⁿ steps. */
export const niceTicks = (min: number, max: number, count = 4): number[] => {
  if (!isFinite(min) || !isFinite(max) || max <= min) return [min]

  const rawStep = (max - min) / count
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const normalized = rawStep / magnitude
  const step =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude

  const ticks: number[] = []
  for (let tick = Math.ceil(min / step) * step; tick <= max + 1e-9; tick += step) {
    ticks.push(Math.round(tick * 1e6) / 1e6)
  }
  return ticks
}

/** Evenly spaced timestamps across the domain, for the shared x-axis. */
export const timeTicks = (from: number, to: number, count = 4): number[] => {
  if (to <= from) return [from]
  const step = (to - from) / count
  return Array.from({ length: count + 1 }, (_, i) => from + i * step)
}

/** A single "<x> <y>" pair. Numbers are stringified explicitly — the project's lint rules
 *  reject implicit number-to-string coercion in template literals. */
const xy = (x: number, y: number) => `${x.toString()} ${y.toString()}`

/** `d` for a smooth-free polyline through the points. */
export const linePath = (points: Point[], x: Scale, y: Scale): string =>
  points
    .map((point, i) => `${i === 0 ? 'M' : 'L'}${xy(x(point.t), y(point.v))}`)
    .join(' ')

/**
 * `d` for a step line — the value holds until the next sample.
 *
 * Used for the connection count, whose samples are 5s buckets. A smoothed curve there would
 * imply a resolution the data does not have.
 */
export const stepPath = (points: Point[], x: Scale, y: Scale): string => {
  if (points.length === 0) return ''

  const parts = [`M${xy(x(points[0].t), y(points[0].v))}`]
  for (let i = 1; i < points.length; i++) {
    parts.push(`L${xy(x(points[i].t), y(points[i - 1].v))}`)
    parts.push(`L${xy(x(points[i].t), y(points[i].v))}`)
  }
  return parts.join(' ')
}

/** `d` for the area under a line, closed to the baseline. */
export const areaPath = (
  points: Point[],
  x: Scale,
  y: Scale,
  baseline: number
): string => {
  if (points.length === 0) return ''
  return [
    linePath(points, x, y),
    `L${xy(x(points[points.length - 1].t), baseline)}`,
    `L${xy(x(points[0].t), baseline)}`,
    'Z',
  ].join(' ')
}

/** The sample nearest a given x position, for the shared crosshair. */
export const nearestPoint = (points: Point[], t: number): Point | undefined => {
  if (points.length === 0) return undefined
  return points.reduce((best, point) =>
    Math.abs(point.t - t) < Math.abs(best.t - t) ? point : best
  )
}

const timeFormatter = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
})

const timeWithSecondsFormatter = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Europe/Berlin',
})

const dayTimeFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
})

// Full HH:MM:SS, not mm:ss — a bare "06:15" on a zoomed-in axis is indistinguishable from
// an hour-and-minute label, and reads as six in the morning. (Confirmed the hard way.)
const secondsFormatter = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Europe/Berlin',
})

export const formatClock = (t: number) => timeFormatter.format(new Date(t))

/**
 * Axis label matched to the visible span: seconds when zoomed right in, a date once the
 * window spans more than half a day and bare HH:MM would be ambiguous across midnight.
 */
export const formatAxisTime = (t: number, spanMs: number) => {
  if (spanMs <= 10 * 60 * 1000) return secondsFormatter.format(new Date(t))
  if (spanMs >= 12 * 60 * 60 * 1000) return dayTimeFormatter.format(new Date(t))
  return timeFormatter.format(new Date(t))
}
export const formatClockWithSeconds = (t: number) =>
  timeWithSecondsFormatter.format(new Date(t))

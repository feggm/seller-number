import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { RemainingMeter } from '@/components/status/RemainingMeter'
import { StatTile } from '@/components/status/StatTile'
import { TimeSeriesFacet } from '@/components/status/TimeSeriesFacet'
import {
  type Point,
  formatClockWithSeconds,
  nearestPoint,
} from '@/components/status/scale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  usePublicStatusHistoryQuery,
  usePublicStatusQuery,
} from '@/clients/usePublicStatusQuery'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/live')({
  component: Live,
})

const REGISTRATION_COLOR = '#2a78d6'
const CONNECTION_COLOR = '#eb6834'
const WINDOW_MINUTES = 60
const LIVE_TAIL_MAX = 900

const numberFormatter = new Intl.NumberFormat('de-DE')

function Live() {
  const { data: status, isLoading: isStatusLoading } = usePublicStatusQuery()
  const { data: history } = usePublicStatusHistoryQuery(WINDOW_MINUTES)

  const [hoverT, setHoverT] = useState<number | undefined>(undefined)

  // Client-side live tail: the persisted samples are 5s buckets, but the page polls every 2s,
  // so the most recent stretch can be drawn at the poll cadence. Kept in a ref so appending a
  // sample does not itself trigger a render — the status query's own update does that.
  const liveTailRef = useRef<Point[]>([])
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!status) return
    const t = new Date(status.generatedAt.utc).getTime()
    const tail = liveTailRef.current
    if (tail.length > 0 && tail[tail.length - 1].t === t) return

    tail.push({ t, v: status.connections })
    if (tail.length > LIVE_TAIL_MAX) tail.splice(0, tail.length - LIVE_TAIL_MAX)
    forceTick((n) => n + 1)
  }, [status])

  if (isStatusLoading || !status) {
    return (
      <Card className="m-4 w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Live-Status</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton />
        </CardContent>
      </Card>
    )
  }

  // The snapshot and the history are separate queries on different intervals, so the history
  // can carry samples newer than the snapshot's own timestamp. Anchoring the axis on the
  // snapshot alone would let those points draw past the plot's right edge into the padding.
  const newestSample = Math.max(
    0,
    ...(history?.connections ?? []).map((point) => new Date(point.t).getTime()),
    ...(history?.registrations ?? []).map((point) => new Date(point.t).getTime()),
    ...liveTailRef.current.map((point) => point.t)
  )
  const now = Math.max(new Date(status.generatedAt.utc).getTime(), newestSample)
  const from = now - WINDOW_MINUTES * 60 * 1000
  const domain: [number, number] = [from, now]

  // ---- registrations: cumulative, against the known ceiling ----
  //
  // The history endpoint returns per-bucket counts inside the window plus an all-time total,
  // so the curve starts at whatever had already been handed out when the window opened.
  const bucketed = history?.registrations ?? []
  const inWindow = bucketed.reduce((sum, point) => sum + point.n, 0)
  const baseline = Math.max((history?.registrationsTotal ?? 0) - inWindow, 0)

  let running = baseline
  const registrationPoints: Point[] = [{ t: from, v: baseline }]
  for (const point of bucketed) {
    running += point.n
    registrationPoints.push({ t: new Date(point.t).getTime(), v: running })
  }
  registrationPoints.push({ t: now, v: running })

  // ---- connections: persisted samples, then the client tail ----

  const tail = liveTailRef.current
  const tailStart = tail.length > 0 ? tail[0].t : Infinity
  const connectionPoints: Point[] = [
    ...(history?.connections ?? [])
      .map((point) => ({ t: new Date(point.t).getTime(), v: point.c }))
      .filter((point) => point.t < tailStart),
    ...tail,
  ].filter((point) => point.t >= from)

  const connectionMax = Math.max(1, ...connectionPoints.map((point) => point.v))

  const hoveredRegistration =
    hoverT !== undefined ? nearestPoint(registrationPoints, hoverT) : undefined
  const hoveredConnection =
    hoverT !== undefined ? nearestPoint(connectionPoints, hoverT) : undefined

  const { numbers, release } = status
  const taken = numbers.registered + numbers.reserved
  // Stock currently in play: everything except what is still behind a future release.
  const releasedTotal = numbers.total - numbers.availableLater

  return (
    <Card className="m-4 w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Live-Status</CardTitle>
        <p className="text-sm text-slate-500">
          {status.eventCategory.name}
          {status.event && (
            <>
              {' · '}
              {status.event.name}
              {status.event.eventDate && ` am ${status.event.eventDate.display}`}
            </>
          )}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {!status.event && (
          <p className="text-sm text-slate-600">
            Zurzeit ist kein Termin geplant, für den Verkäufernummern vergeben werden.
          </p>
        )}

        {status.event && (
          <>
            {!status.reservationTargetMatches && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Für diese Kategorie sind mehrere Termine angelegt. Die Zahlen hier
                beschreiben den <strong>nächstgelegenen</strong> Termin — den, den auch die
                Startseite anbietet. Die Reservierung im Backend würde derzeit auf einen
                anderen Termin buchen.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                label="Vergeben"
                value={numbers.registered}
                accent={REGISTRATION_COLOR}
                hint="abgeschlossene Registrierungen"
              />
              <StatTile
                label="Im Registrierungsprozess"
                value={numbers.reserved}
                hint="Nummer reserviert, Formular offen"
              />
              <StatTile
                label="Noch frei"
                value={numbers.availableNow}
                hint={
                  numbers.availableLater > 0
                    ? `${numberFormatter.format(numbers.availableLater)} weitere noch gesperrt`
                    : undefined
                }
              />
              <StatTile
                label="Aktive Verbindungen"
                value={status.connections}
                accent={CONNECTION_COLOR}
                hint="offene Browser-Tabs, inkl. dieser Seite"
              />
            </div>

            {/* The meter covers only what is actually in play — counting locked stock as
                "frei" would overstate availability. The blocks below account for the rest. */}
            <RemainingMeter total={releasedTotal} taken={taken} fill={REGISTRATION_COLOR} />

            <div className="flex flex-col gap-2">
              <p className="text-sm text-slate-600">
                {release.isObtainableNow
                  ? 'Nummern sind aktuell freigeschaltet.'
                  : 'Derzeit sind keine Nummern freigeschaltet.'}
              </p>

              {status.upcomingReleases.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Es sind keine weiteren Freischaltungen geplant — alle Nummern sind bereits
                  im Umlauf.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-slate-400">
                    {status.upcomingReleases.length === 1
                      ? 'Kommende Freischaltung'
                      : `Kommende Freischaltungen (${status.upcomingReleases.length.toString()})`}
                  </span>
                  {status.upcomingReleases.map((block) => (
                    <div
                      key={block.opensAt.utc}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2"
                    >
                      <span className="text-sm text-slate-700">
                        <span className="font-medium tabular-nums">
                          {numberFormatter.format(block.total)}
                        </span>{' '}
                        {block.total === 1 ? 'Nummer' : 'Nummern'}
                        {block.variations.length > 0 && (
                          <span className="text-slate-500">
                            {' · '}
                            {block.variations.join(', ')}
                          </span>
                        )}
                      </span>
                      <span className="text-xs tabular-nums text-slate-500">
                        ab {block.opensAt.display}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs text-slate-400">
                  Letzte {WINDOW_MINUTES} Minuten
                </span>
                {hoverT !== undefined && (
                  <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums shadow-sm">
                    <div className="text-slate-500">{formatClockWithSeconds(hoverT)}</div>
                    {hoveredRegistration && (
                      <div className="text-slate-700">
                        Vergeben: {numberFormatter.format(hoveredRegistration.v)}
                      </div>
                    )}
                    {hoveredConnection && (
                      <div className="text-slate-700">
                        Verbindungen: {numberFormatter.format(hoveredConnection.v)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <TimeSeriesFacet
                title="Vergebene Nummern"
                subtitle="exakt, aus den Registrierungszeitpunkten"
                points={registrationPoints}
                domain={domain}
                yMax={numbers.total}
                color={REGISTRATION_COLOR}
                mode="area"
                referenceValue={numbers.total}
                referenceLabel={`${numberFormatter.format(numbers.total)} Nummern gesamt`}
                hoverT={hoverT}
                onHoverT={setHoverT}
              />

              <TimeSeriesFacet
                title="Aktive Verbindungen"
                subtitle={`${(history?.bucketSeconds ?? 5).toString()}-Sekunden-Stichproben`}
                points={connectionPoints}
                domain={domain}
                yMax={connectionMax}
                color={CONNECTION_COLOR}
                mode="step"
                height={130}
                showXAxis
                hoverT={hoverT}
                onHoverT={setHoverT}
              />
            </div>

            {status.variations.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-slate-400">Nach Variante</span>
                {status.variations.map((variation) => (
                  <div
                    key={variation.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-slate-200 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {variation.name ?? 'Unbenannt'}
                    </span>
                    <span className="text-xs tabular-nums text-slate-500">
                      {/* "0 von 0 frei" is nonsense for a variation whose stock has not been
                          released yet — say that instead. */}
                      {variation.numbers.total - variation.numbers.availableLater === 0
                        ? `noch nicht freigeschaltet · ${numberFormatter.format(
                            variation.numbers.availableLater
                          )} ab ${variation.release.nextOpensAt?.display ?? 'später'}`
                        : `${numberFormatter.format(
                            variation.numbers.availableNow
                          )} von ${numberFormatter.format(
                            variation.numbers.total - variation.numbers.availableLater
                          )} frei${
                            variation.numbers.availableLater > 0
                              ? ` · ${numberFormatter.format(
                                  variation.numbers.availableLater
                                )} später`
                              : ''
                          }`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="text-xs leading-relaxed text-slate-400">
          „Aktive Verbindungen" zählt offene Browser-Verbindungen, nicht Personen: mehrere
          Tabs auf einem Gerät zählen mehrfach, und ein Gerät, dessen Verbindung gerade neu
          aufgebaut wird, fehlt kurzzeitig. Stand: {status.generatedAt.display}.
        </p>
      </CardContent>
    </Card>
  )
}

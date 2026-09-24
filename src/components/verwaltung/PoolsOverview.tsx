import type { Event, PermanentNumber, Variation } from '@/clients/admin/useRegisterQueries'
import {
  resolveNumbers,
  useEventSellerNumbersQuery,
  usePoolsQuery,
} from '@/clients/admin/useRegisterQueries'
import { useEnsurePermanentPoolMutation } from '@/clients/admin/useRegisterMutations'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useState } from 'react'

import { Field, Select } from './fields'
import { describeRange, formatDay, gapsBetween } from './helpers'

/** The pools of one event, one row each: which numbers, who may take them and when, how many
 *  are taken. The closed Dauernummern pool sits next to the public ranges, so an extra range
 *  opened because staff sit a market out reads as what it is. Read-only — pools are still
 *  built in the PocketBase admin UI. */
export function PoolsOverview({
  events,
  variations,
  registerNumbers,
  registerTerm,
}: {
  events: Event[]
  variations: Variation[]
  registerNumbers: PermanentNumber[]
  registerTerm: string
}) {
  const ensure = useEnsurePermanentPoolMutation()
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter((e) => e.eventDate.slice(0, 10) >= today)
  const [eventId, setEventId] = useState(
    upcoming.length > 0 ? upcoming[upcoming.length - 1].id : (events[0]?.id ?? '')
  )
  const pools = usePoolsQuery(eventId)
  const poolIds = (pools.data ?? []).map((p) => p.id)
  const sellerNumbers = useEventSellerNumbersQuery(poolIds)

  if (!eventId) return <p className="text-muted-foreground text-sm">Kein Event in dieser Kategorie.</p>
  if (!pools.data || (poolIds.length > 0 && !sellerNumbers.data)) {
    return <Skeleton className="h-40 w-full" />
  }

  const variationName = (id: string) =>
    variations.find((v) => v.id === id)?.sellerNumberVariationName ?? '?'
  const takenByKey = new Map(
    (sellerNumbers.data ?? []).map((s) => [`${s.sellerNumberPool}:${String(s.sellerNumberNumber)}`, s])
  )
  // What the register's pool of each variation should hold: the aktiv numbers. Compared with
  // the flagged pool of the event, if there is one; numbers found in a public pool are the
  // operator's to move.
  const isPast = (events.find((e) => e.id === eventId)?.eventDate.slice(0, 10) ?? '') < today
  const wanted = new Map<string, number[]>()
  for (const n of registerNumbers) {
    if (n.status !== 'aktiv') continue
    wanted.set(n.sellerNumberVariation, [...(wanted.get(n.sellerNumberVariation) ?? []), n.permanentNumberNumber])
  }
  const poolTasks = [...wanted.entries()].map(([variationId, numbers]) => {
    const permanent = pools.data.find((p) => p.sellerNumberVariation === variationId && p.isPermanentPool)
    const have = permanent ? resolveNumbers(permanent.numbersAsJsonArray) : []
    const missing = numbers.filter((n) => !have.includes(n))
    const inPublic = numbers.filter((n) =>
      pools.data.some((p) => p.sellerNumberVariation === variationId && !p.isPermanentPool && resolveNumbers(p.numbersAsJsonArray).includes(n))
    )
    return { variationId, variationName: variationName(variationId), numbers, permanent, have, missing, inPublic }
  })
  const rows = pools.data.map((pool) => {
    const numbers = resolveNumbers(pool.numbersAsJsonArray)
    const closed = pool.obtainableTo !== '' && pool.obtainableTo.slice(0, 10) < today
    const notYet = pool.obtainableFrom !== '' && pool.obtainableFrom.slice(0, 10) > today
    let registered = 0
    let held = 0
    for (const n of numbers) {
      const s = takenByKey.get(`${pool.id}:${String(n)}`)
      if (!s) continue
      if (s.sellerDetails) registered += 1
      else held += 1
    }
    return {
      id: pool.id,
      range: describeRange(numbers),
      variationName: variationName(pool.sellerNumberVariation),
      permanent: pool.isPermanentPool,
      closed,
      notYet,
      from: pool.obtainableFrom,
      to: pool.obtainableTo,
      total: numbers.length,
      registered,
      held,
      free: numbers.length - registered - held,
    }
  })
  rows.sort((a, b) => Number(a.permanent) - Number(b.permanent) || a.range.localeCompare(b.range, undefined, { numeric: true }))
  const gaps = gapsBetween(pools.data.flatMap((p) => resolveNumbers(p.numbersAsJsonArray)))

  return (
    <div className="space-y-3">
      <Field label="Event" className="max-w-md">
        <Select value={eventId} onChange={(e) => { setEventId(e.target.value); }}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.eventName} — {formatDay(e.eventDate)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nummern</TableHead>
              <TableHead>Variation</TableHead>
              <TableHead>Buchbar</TableHead>
              <TableHead className="text-right">gesamt</TableHead>
              <TableHead className="text-right">registriert</TableHead>
              <TableHead className="text-right">reserviert</TableHead>
              <TableHead className="text-right">{rows.some((r) => r.permanent) ? 'frei / unbesetzt' : 'frei'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.range}</TableCell>
                <TableCell className="text-sm">{r.variationName}</TableCell>
                <TableCell className="text-sm">
                  {r.permanent ? (
                    <span className="rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-800" title="isPermanentPool: nur das Register schreibt hinein">
                      🔒 {registerTerm}n-Pool
                    </span>
                  ) : r.closed ? (
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                      beendet am {formatDay(r.to)}
                    </span>
                  ) : r.notYet ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      ab {formatDay(r.from)}
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                      offen{r.to ? ` bis ${formatDay(r.to)}` : ''}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.total}</TableCell>
                <TableCell className="text-right tabular-nums">{r.registered}</TableCell>
                <TableCell className="text-right tabular-nums">{r.held}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.free}
                  {r.permanent && r.free > 0 && <span className="text-muted-foreground text-xs"> unbesetzt</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {gaps.length > 0 && (
        <p className="text-muted-foreground text-xs">
          <strong>Ausgelassen:</strong> <span className="font-mono">{describeRange(gaps)}</span> — in keinem Pool
          dieses Events. Kleidergrößen (bei der Anziehbar 32–48 gerade, beim Kinderkleidermarkt 50, 56, 62 …)
          lesen sich auf dem Etikett als Größe; beim Kinderkleidermarkt fehlen
          im Publikums-Pool außerdem die aktiven Dauernummern, die im 🔒-Pool liegen.
        </p>
      )}
      {!isPast && poolTasks.length > 0 && (
        <div className="space-y-2 rounded-md border p-3">
          <h4 className="text-sm font-semibold">{registerTerm}n-Pool dieses Events</h4>
          {poolTasks.map((t) => (
            <div key={t.variationId} className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                {t.variationName}: {String(t.numbers.length)} aktive {registerTerm}n
                {t.permanent ? (
                  t.missing.length === 0 ? (
                    <span className="text-emerald-700"> — alle im 🔒-Pool</span>
                  ) : (
                    <span className="text-amber-700"> — {String(t.missing.length)} fehlen im 🔒-Pool: {describeRange(t.missing)}</span>
                  )
                ) : (
                  <span className="text-amber-700"> — noch kein 🔒-Pool</span>
                )}
                {t.inPublic.length > 0 && (
                  <span className="text-red-700"> · im Publikums-Pool: {describeRange(t.inPublic)} — dort herausnehmen, sonst geht die Nummer an jemand anderen</span>
                )}
              </span>
              {(!t.permanent || t.missing.length > 0) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={ensure.isPending}
                  onClick={() => {
                    void ensure
                      .mutateAsync({
                        eventId,
                        variationId: t.variationId,
                        numbers: t.numbers,
                        existingPoolId: t.permanent?.id,
                        existingNumbers: t.have,
                      })
                      .then((r) => {
                        toast.success(r.created ? `${registerTerm}n-Pool angelegt (${String(r.numbers)} Nummern)` : `${registerTerm}n-Pool nachgezogen (${String(r.numbers)} Nummern)`)
                      })
                  }}
                >
                  {t.permanent ? 'Pool nachziehen' : 'Pool anlegen'}
                </Button>
              )}
            </div>
          ))}
          <p className="text-muted-foreground text-xs">
            Legt den Pool mit genau den aktiven Nummern an (Häkchen <code>isPermanentPool</code>, Buchungsfenster in der
            Vergangenheit) oder ergänzt fehlende Nummern. Aus einem Pool genommen wird hier nichts — eine pausierte oder
            freigegebene Nummer bleibt drin, bis du sie in PocketBase entfernst.
          </p>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Publikums-Pools werden noch in der PocketBase-Admin-UI angelegt. Ein {registerTerm}n-Pool trägt dort das Häkchen
        <code> isPermanentPool</code> und ein <code>obtainableTo</code> in der Vergangenheit: niemand kann daraus
        buchen, nur „Dauernummern in Event kopieren" trägt ein.
      </p>
    </div>
  )
}

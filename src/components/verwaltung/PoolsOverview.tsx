import type { Event, Variation } from '@/clients/admin/useRegisterQueries'
import {
  resolveNumbers,
  useEventSellerNumbersQuery,
  usePoolsQuery,
} from '@/clients/admin/useRegisterQueries'
import { Skeleton } from '@/components/ui/skeleton'
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
import { describeRange, formatDay } from './helpers'

/** The pools of one event, one row each: which numbers, who may take them and when, how many
 *  are taken. The closed Dauernummern pool sits next to the public ranges, so an extra range
 *  opened because staff sit a market out reads as what it is. Read-only — pools are still
 *  built in the PocketBase admin UI. */
export function PoolsOverview({
  events,
  variations,
  registerTerm,
}: {
  events: Event[]
  variations: Variation[]
  registerTerm: string
}) {
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
      <p className="text-muted-foreground text-xs">
        Pools werden noch in der PocketBase-Admin-UI angelegt. Ein {registerTerm}n-Pool trägt dort das Häkchen
        <code> isPermanentPool</code> und ein <code>obtainableTo</code> in der Vergangenheit: niemand kann daraus
        buchen, nur „Dauernummern in Event kopieren" trägt ein.
      </p>
    </div>
  )
}

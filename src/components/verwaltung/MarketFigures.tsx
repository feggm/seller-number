import type {
  MarketStats,
  NumberMarket,
  PermanentNumber,
} from '@/clients/admin/useRegisterQueries'
import { marketKey } from '@/clients/admin/useRegisterQueries'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { formatDay } from './helpers'

export const WINDOW = 4

export const euro = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? '—' : `${(cents / 100).toFixed(2).replace('.', ',')} €`

const median = (values: number[]) => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null

const MATCH_LABEL = {
  holder: { text: 'Halter:in', cls: 'text-emerald-700' },
  nameChange: { text: 'Namensänderung?', cls: 'text-amber-700' },
  mismatch: { text: 'andere Person', cls: 'text-red-700' },
} as const

/**
 * The same arithmetic the push does (permanent-numbers-statistics.js): the newest four
 * `holder` rows of the current holder, their means, and the median of those markets' medians.
 * Computed on read, so the page and the stored flag can be held against each other.
 */
export function windowOf(
  number: PermanentNumber,
  rows: NumberMarket[],
  statsByMarket: Map<string, MarketStats>
) {
  const own = rows
    .filter((r) => r.permanentNumber === number.id)
    .sort((a, b) => marketKey(b.market).localeCompare(marketKey(a.market)))
  const window = own.filter((r) => r.holderMatch === 'holder' && r.holder === number.holder).slice(0, WINDOW)
  const medians = window
    .map((r) => statsByMarket.get(r.market))
    .filter((s): s is MarketStats => s?.itemsMedian !== null && s?.itemsMedian !== undefined && s.revenueCentsMedian !== null)
  const complete = window.length === WINDOW && medians.length === WINDOW
  const itemsMean = mean(window.map((r) => r.itemsSold))
  const revenueMean = mean(window.map((r) => r.revenueCents))
  const itemsRef = median(medians.map((s) => s.itemsMedian ?? 0))
  const revenueRef = median(medians.map((s) => s.revenueCentsMedian ?? 0))
  const flag =
    complete && itemsMean !== null && revenueMean !== null && itemsRef !== null && revenueRef !== null
      ? itemsMean < itemsRef && revenueMean < revenueRef
      : false
  return { own, window, complete, itemsMean, revenueMean, itemsRef, revenueRef, flag }
}

/** One number's markets, newest first, against the market's medians. */
export function MarketFigures({
  number,
  rows,
  statsByMarket,
}: {
  number: PermanentNumber
  rows: NumberMarket[]
  statsByMarket: Map<string, MarketStats>
}) {
  const w = windowOf(number, rows, statsByMarket)
  if (w.own.length === 0) {
    return <p className="text-muted-foreground text-xs">Noch keine Marktzahlen — kommen mit dem nächsten Push nach dem Markt.</p>
  }
  const fmt1 = (v: number | null) => (v === null ? '—' : v.toFixed(1).replace('.', ','))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {w.complete ? (
          <>
            <span>
              Ø der letzten {WINDOW}: <strong>{fmt1(w.itemsMean)} Teile</strong>, <strong>{euro(w.revenueMean === null ? null : Math.round(w.revenueMean))}</strong>
            </span>
            <span className="text-muted-foreground">
              Median der Märkte: {fmt1(w.itemsRef)} Teile, {euro(w.revenueRef === null ? null : Math.round(w.revenueRef))}
            </span>
            <span className={w.flag ? 'rounded bg-red-100 px-2 py-0.5 text-xs text-red-800' : 'rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800'}>
              {w.flag ? 'Review-Flag: beides unter dem Median' : 'kein Anlass zur Review'}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            {String(w.window.length)} von {WINDOW} Märkten unter dieser Halter:in — noch kein volles Fenster, keine Flag.
          </span>
        )}
        {number.reviewedAt && (
          <span className="text-muted-foreground text-xs">
            zuletzt gerechnet {formatDay(number.reviewedAt)}
            {number.reviewFlag !== w.flag && ' · gespeicherte Flag weicht ab — nächster Push gleicht an'}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Markt</TableHead>
              <TableHead className="text-right">Teile</TableHead>
              <TableHead className="text-right">Umsatz</TableHead>
              <TableHead>verkauft von</TableHead>
              <TableHead className="text-right">Markt-Median Teile</TableHead>
              <TableHead className="text-right">Markt-Median Umsatz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {w.own.map((r) => {
              const s = statsByMarket.get(r.market)
              const counts = w.window.includes(r)
              return (
                <TableRow key={r.id} className={counts ? undefined : 'text-muted-foreground'}>
                  <TableCell className="font-mono">
                    {r.market}
                    {counts && <span className="ml-1 text-xs text-emerald-700" title="zählt für das Fenster">●</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.itemsSold}</TableCell>
                  <TableCell className="text-right tabular-nums">{euro(r.revenueCents)}</TableCell>
                  <TableCell className={`text-xs ${MATCH_LABEL[r.holderMatch].cls}`}>{MATCH_LABEL[r.holderMatch].text}</TableCell>
                  <TableCell className="text-right tabular-nums">{s?.itemsMedian ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{euro(s?.revenueCentsMedian)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs">
        Nur Zeilen mit „Halter:in" zählen — eine andere Person unter derselben Nummer, auch eine
        abweichende Schreibweise in alten Seeds, bleibt sichtbar, aber außen vor.
      </p>
    </div>
  )
}

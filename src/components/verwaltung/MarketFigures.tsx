import type {
  MarketStats,
  NumberMarket,
  PermanentNumber,
} from '@/clients/admin/useRegisterQueries'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { WINDOW, euro, windowOf } from './figures'
import { formatDay } from './helpers'

const MATCH_LABEL = {
  holder: { text: 'Halter:in', cls: 'text-emerald-700' },
  nameChange: { text: 'Namensänderung?', cls: 'text-amber-700' },
  mismatch: { text: 'andere Person', cls: 'text-red-700' },
} as const

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

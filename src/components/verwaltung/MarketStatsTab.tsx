import type {
  Event,
  MarketStats,
  PermanentNumber,
  TopSeller,
} from '@/clients/admin/useRegisterQueries'
import { marketKey } from '@/clients/admin/useRegisterQueries'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { WINDOW, euro } from './figures'

const fmt1 = (v: number | null) => (v === null ? '—' : v.toFixed(1).replace('.', ','))

/** The category's markets as the register knows them, and the people who sell strongly
 *  without a Dauernummer — the candidates for one. */
export function MarketStatsTab({
  stats,
  topSellers,
  events,
  registerNumbers,
  registerTerm,
  onShowSeller,
}: {
  stats: MarketStats[]
  topSellers: TopSeller[]
  events: Event[]
  registerNumbers: PermanentNumber[]
  registerTerm: string
  /** Open the Verkäuferliste of that event on that number — where the name is. */
  onShowSeller: (eventId: string, number: number) => void
}) {
  const markets = [...stats].sort((a, b) => marketKey(b.market).localeCompare(marketKey(a.market)))
  const eventName = (id: string) => events.find((e) => e.id === id)?.eventName ?? ''
  const lastMarkets = markets.slice(0, WINDOW).map((m) => m.market)

  // A free seller draws another number every market, so the person is recognised by the
  // hash pair across markets: "in three of the last four markets among the top sellers".
  const byPerson = new Map<string, { appearances: TopSeller[]; numbers: Set<number> }>()
  for (const t of topSellers) {
    if (!lastMarkets.includes(t.market)) continue
    const key = `${t.firstNameHash}|${t.lastNameHash}`
    const entry = byPerson.get(key) ?? { appearances: [], numbers: new Set<number>() }
    entry.appearances.push(t)
    entry.numbers.add(t.number)
    byPerson.set(key, entry)
  }
  const registerByNumber = new Map(registerNumbers.map((n) => [n.permanentNumberNumber, n]))
  const candidates = [...byPerson.values()]
    .filter((p) => p.appearances.length >= 2)
    .map((p) => {
      const sorted = [...p.appearances].sort((a, b) => marketKey(b.market).localeCompare(marketKey(a.market)))
      const latest = sorted[0]
      return {
        key: `${latest.firstNameHash}|${latest.lastNameHash}`,
        count: p.appearances.length,
        latest,
        appearances: sorted,
        // The latest number, if it has become a Dauernummer since, says the candidate is done.
        alreadyRegistered: registerByNumber.get(latest.number)?.status === 'aktiv',
      }
    })
    .sort((a, b) => b.count - a.count || b.latest.revenueCents - a.latest.revenueCents)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Märkte</h3>
        {markets.length === 0 ? (
          <p className="text-muted-foreground text-sm">Noch keine Marktzahlen für diese Kategorie.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Markt</TableHead>
                  <TableHead className="text-right">Verkäufer</TableHead>
                  <TableHead className="text-right">Teile Ø / Median</TableHead>
                  <TableHead className="text-right">Umsatz Ø / Median</TableHead>
                  <TableHead className="text-right">{registerTerm}n</TableHead>
                  <TableHead className="text-right">deren Teile Ø / Median</TableHead>
                  <TableHead className="text-right">deren Umsatz Ø / Median</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {markets.map((m, i) => (
                  <TableRow key={m.id} className={i < WINDOW ? undefined : 'text-muted-foreground'}>
                    <TableCell className="font-mono">
                      {m.market}
                      {i < WINDOW && <span className="ml-1 text-xs text-emerald-700" title="im Vier-Märkte-Fenster">●</span>}
                      {m.event && <span className="text-muted-foreground ml-2 text-xs">{eventName(m.event)}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.sellers}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt1(m.itemsMean)} / {fmt1(m.itemsMedian)}</TableCell>
                    <TableCell className="text-right tabular-nums">{euro(m.revenueCentsMean)} / {euro(m.revenueCentsMedian)}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.permanentSellers}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt1(m.permanentItemsMean)} / {fmt1(m.permanentItemsMedian)}</TableCell>
                    <TableCell className="text-right tabular-nums">{euro(m.permanentRevenueCentsMean)} / {euro(m.permanentRevenueCentsMedian)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-muted-foreground text-xs">
          Die Review-Flag einer {registerTerm} vergleicht ihre letzten vier Märkte mit dem Median der
          Mediane dieser vier Märkte (●). Zahlen kommen von der Kasse nach jedem Markt („Marktzahlen
          übertragen") und aus dem Backfill der alten Dumps.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Kandidaten für eine {registerTerm}</h3>
        <p className="text-muted-foreground text-xs">
          Verkäufer:innen ohne {registerTerm}, die in den letzten {WINDOW} Märkten mehr als einmal unter den
          Top 20 nach Umsatz oder Teilen waren — über die Namens-Hashes erkannt, weil sie jeden Markt
          eine andere Nummer ziehen. Der Name steht in der Registrierung des jeweiligen Events
          (Verkäuferliste → Nummer), für alte Märkte ohne Event nur die Nummer.
        </p>
        {candidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">Keine Kandidaten — oder noch zu wenig Märkte.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">Top-20-Märkte</TableHead>
                  <TableHead>zuletzt</TableHead>
                  <TableHead>Märkte (bei Events mit Link zum Namen)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.key} className={c.alreadyRegistered ? 'text-muted-foreground' : undefined}>
                    <TableCell className="text-right tabular-nums">{c.count} von {WINDOW}</TableCell>
                    <TableCell className="text-sm">
                      {c.latest.market}: Nr. <span className="font-mono font-semibold">{c.latest.number}</span>
                      {c.latest.event && <span className="text-muted-foreground ml-1 text-xs">{eventName(c.latest.event)}</span>}
                      {c.alreadyRegistered && <span className="ml-2 text-xs">inzwischen {registerTerm}</span>}
                      {c.latest.event && (
                        <Button
                          size="sm"
                          variant="link"
                          className="h-auto px-2 py-0 text-xs"
                          onClick={() => { onShowSeller(c.latest.event, c.latest.number); }}
                        >
                          Name in der Verkäuferliste
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-normal">
                      {c.appearances.map((a, i) => (
                        <span key={a.id}>
                          {i > 0 && ' · '}
                          {a.market}: Nr.{' '}
                          {a.event ? (
                            <button
                              type="button"
                              className="font-mono font-semibold underline decoration-dotted hover:text-sky-700"
                              title={`Verkäuferliste ${eventName(a.event)} öffnen`}
                              onClick={() => { onShowSeller(a.event, a.number); }}
                            >
                              {String(a.number)} ↗
                            </button>
                          ) : (
                            <span className="font-mono">{String(a.number)}</span>
                          )}{' '}
                          ({String(a.itemsSold)} Teile, {euro(a.revenueCents)})
                        </span>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

import type {
  Event,
  MarketStats,
  PermanentNumber,
  TopSeller,
} from '@/clients/admin/useRegisterQueries'
import { marketKey, useEventRegistrationNamesQuery } from '@/clients/admin/useRegisterQueries'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { useState } from 'react'

import { TOP_N, TOP_N_ALL, WINDOW, euro } from './figures'

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
  const [showAll, setShowAll] = useState(false)
  const cut = showAll ? TOP_N_ALL : TOP_N
  const markets = [...stats].sort((a, b) => marketKey(b.market).localeCompare(marketKey(a.market)))
  const eventName = (id: string) => events.find((e) => e.id === id)?.eventName ?? ''
  const lastMarkets = markets.slice(0, WINDOW).map((m) => m.market)

  // A free seller draws another number every market, so the person is recognised by the
  // hash pair across markets: "in three of the last four markets among the top sellers".
  const byPerson = new Map<string, { appearances: TopSeller[]; numbers: Set<number> }>()
  for (const t of topSellers) {
    if (!lastMarkets.includes(t.market)) continue
    if (t.rankRevenue > cut && t.rankItems > cut) continue
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

  // The name comes from the registration of the newest market that has an event.
  const names = useEventRegistrationNamesQuery(
    candidates.flatMap((c) => c.appearances.filter((a) => a.event !== '').slice(0, 1).map((a) => a.event))
  )
  const nameOf = (c: (typeof candidates)[number]) => {
    const withEvent = c.appearances.find((a) => a.event !== '')
    if (!withEvent) return null
    return { name: names.data?.get(`${withEvent.event}|${String(withEvent.number)}`) ?? null, appearance: withEvent }
  }

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
                  <TableHead className="text-right" title="angemeldete Verkaufsnummern mit Person">Verkäufer</TableHead>
                  <TableHead className="text-right" title="davon mit mindestens einem verkauften Teil">davon verkauft</TableHead>
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
                    <TableCell className="font-mono" title={m.event ? eventName(m.event) : undefined}>
                      {m.market}
                      {i < WINDOW && <span className="ml-1 text-xs text-emerald-700" title="im Vier-Märkte-Fenster">●</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.sellers}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.sellersSold > 0 ? (
                        <>
                          {m.sellersSold}
                          <span className="text-muted-foreground ml-1 text-xs">({String(Math.round((100 * m.sellersSold) / Math.max(1, m.sellers)))} %)</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground" title="kommt mit dem nächsten Push">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt1(m.itemsMean)} / {fmt1(m.itemsMedian)}</TableCell>
                    <TableCell className="text-right tabular-nums">{euro(m.revenueCentsMean)} / {euro(m.revenueCentsMedian)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.permanentSellers}
                      {m.permanentSellersSold > 0 && m.permanentSellersSold < m.permanentSellers && (
                        <span className="text-muted-foreground ml-1 text-xs" title="davon mit Verkauf">({m.permanentSellersSold})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt1(m.permanentItemsMean)} / {fmt1(m.permanentItemsMedian)}</TableCell>
                    <TableCell className="text-right tabular-nums">{euro(m.permanentRevenueCentsMean)} / {euro(m.permanentRevenueCentsMedian)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-muted-foreground text-xs">
          „Verkäufer" zählt die angemeldeten Nummern mit Person, „davon verkauft" die mit mindestens einem
          verkauften Teil; Ø und Median rechnen über alle angemeldeten. Die Review-Flag einer {registerTerm} vergleicht ihre letzten vier Märkte mit dem Median der
          Mediane dieser vier Märkte (●). Zahlen kommen von der Kasse nach jedem Markt („Marktzahlen
          übertragen") und aus dem Backfill der alten Dumps.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Kandidaten für eine {registerTerm}</h3>
        <p className="text-muted-foreground text-xs">
          Verkäufer:innen ohne {registerTerm}, die in den letzten {WINDOW} Märkten mehr als einmal unter den
          Top {cut} nach Umsatz oder Teilen waren — über die Namens-Hashes erkannt, weil sie jeden Markt
          eine andere Nummer ziehen. Der Name kommt aus der Registrierung des neuesten Markts mit Event;
          für alte Märkte ohne Event gibt es nur die Nummer.
        </p>
        <Button size="sm" variant="outline" onClick={() => { setShowAll((v) => !v); }}>
          {showAll ? `nur Top ${String(TOP_N)}` : `mehr … (Top ${String(TOP_N_ALL)})`}
        </Button>
        {candidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">Keine Kandidaten — oder noch zu wenig Märkte.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">Top-{cut}-Märkte</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>zuletzt</TableHead>
                  <TableHead>Märkte (bei Events mit Link zur Verkäuferliste)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.key} className={c.alreadyRegistered ? 'text-muted-foreground' : undefined}>
                    <TableCell className="text-right tabular-nums">{c.count} von {WINDOW}</TableCell>
                    <TableCell className="text-sm">
                      {(() => {
                        const n = nameOf(c)
                        if (!n) return <span className="text-muted-foreground text-xs">nur alte Märkte ohne Event</span>
                        if (!names.data) return <span className="text-muted-foreground">…</span>
                        return n.name ? (
                          <Button
                            size="sm"
                            variant="link"
                            className="h-auto p-0 text-sm font-semibold"
                            title={`Verkäuferliste ${eventName(n.appearance.event)} öffnen`}
                            onClick={() => { onShowSeller(n.appearance.event, n.appearance.number); }}
                          >
                            {n.name}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs" title="Nummer im Event nicht mehr registriert">unbekannt</span>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.latest.market}: Nr. <span className="font-mono font-semibold">{c.latest.number}</span>
                      {c.latest.event && <span className="text-muted-foreground ml-1 text-xs">{eventName(c.latest.event)}</span>}
                      {c.alreadyRegistered && <span className="ml-2 text-xs">inzwischen {registerTerm}</span>}
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

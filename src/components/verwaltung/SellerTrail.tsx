import type { SellerHistoryEntry } from '@/clients/admin/useRegisterQueries'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { euro } from './figures'
import { PagingBar } from './PagingBar'
import { pageOf, usePaging } from './usePaging'

const TRAIL_PAGE = 10

/** Every market the registered person sold at, newest first — the number drawn there and
 *  its figures. Read from the Kasse's trail by name hash, so a changed spelling is a gap. */
export function SellerTrail({ history }: { history: SellerHistoryEntry }) {
  const page = pageOf(history.trail, usePaging(history.sellerNumberId, TRAIL_PAGE))
  return (
    <div className="space-y-2 border-t pt-3">
      <h4 className="text-sm font-semibold">
        Bisherige Märkte <span className="text-muted-foreground font-normal">· {String(history.markets)} seit {history.firstMarket ?? ''}</span>
      </h4>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Markt</TableHead>
              <TableHead className="text-right">Nr.</TableHead>
              <TableHead className="text-right">Teile</TableHead>
              <TableHead className="text-right">Umsatz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.rows.map((m) => (
              <TableRow key={m.market}>
                <TableCell className="font-mono">{m.market}</TableCell>
                <TableCell className="text-right font-mono">{m.number}</TableCell>
                <TableCell className="text-right tabular-nums">{m.itemsSold}</TableCell>
                <TableCell className="text-right tabular-nums">{euro(m.revenueCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PagingBar view={page} noun="Märkten" />
      <p className="text-muted-foreground text-xs">
        Über den Namens-Hash erkannt — eine andere Schreibweise in einem früheren Markt taucht hier nicht auf.
      </p>
    </div>
  )
}

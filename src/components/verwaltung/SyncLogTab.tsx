import type { Event, SyncLogEntry } from '@/clients/admin/useRegisterQueries'
import { useSyncLogQuery } from '@/clients/admin/useRegisterQueries'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const KIND_LABEL: Record<string, string> = {
  'export-assignment': 'Export an die Kasse',
  'export-events': 'Event-Liste an die Kasse',
  'export-ack': 'Import an der Kasse bestätigt',
  'permanent-numbers-import': 'Register-Import',
  'permanent-numbers-materialise': 'Dauernummern in Event kopiert',
  'permanent-numbers-statistics': 'Marktzahlen von der Kasse',
}

const fmtWhen = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : iso
}

/** The counters of an entry, as "created 45 · already 0 · …" — never a name, the log holds none. */
const summarise = (summary: unknown) => {
  if (!summary || typeof summary !== 'object') return ''
  return Object.entries(summary as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
    .map(([k, v]) => `${k} ${String(v as string | number)}`)
    .join(' · ')
}

/** PocketBase's own record of every sync in or out — the other side of the Kasse's audit log. */
export function SyncLogTab({ events }: { events: Event[] }) {
  const log = useSyncLogQuery(true)
  if (!log.data) return <Skeleton className="h-40 w-full" />
  const eventName = (id: string) => events.find((e) => e.id === id)?.eventName ?? ''
  // Entries of this category's events, plus the ones without an event (they carry the mode).
  const eventIds = new Set(events.map((e) => e.id))
  const rows = log.data.filter((r) => r.event === '' || eventIds.has(r.event))

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zeit</TableHead>
              <TableHead>Vorgang</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Konto</TableHead>
              <TableHead className="text-right">Zeilen</TableHead>
              <TableHead>Ergebnis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: SyncLogEntry) => (
              <TableRow key={r.id} className={r.dryRun ? 'text-muted-foreground' : undefined}>
                <TableCell className="text-xs tabular-nums whitespace-nowrap">{fmtWhen(r.finishedAt || r.startedAt)}</TableCell>
                <TableCell className="text-sm">
                  <span className="text-muted-foreground mr-1">{r.direction === 'out' ? '→' : '←'}</span>
                  {KIND_LABEL[r.kind] ?? r.kind}
                  {r.mode && <span className="text-muted-foreground ml-1 text-xs">{r.mode}</span>}
                  {r.dryRun && <span className="ml-1 rounded bg-slate-200 px-1.5 text-xs">Probelauf</span>}
                </TableCell>
                <TableCell className="text-xs">{r.event ? eventName(r.event) : '—'}</TableCell>
                <TableCell className="text-xs">{r.client || '—'}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{r.rowCount ?? '—'}</TableCell>
                <TableCell className="text-xs whitespace-normal">
                  {r.status === 'error' ? (
                    <span className="text-red-700">Fehler · {summarise(r.summary)}</span>
                  ) : (
                    <span>
                      {summarise(r.summary)}
                      {r.checksum && <span className="text-muted-foreground font-mono"> · {r.checksum.slice(0, 10)}…</span>}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs">
        Die letzten 200 Einträge; Probeläufe grau. Der Export ist ein Pull der Kasse, „bestätigt" der Import dort — erst
        das ist ein Sync. Personendaten stehen hier nie, nur Zähler.
      </p>
    </div>
  )
}

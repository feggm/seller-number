import type { Holder, PermanentNumber } from '@/clients/admin/useRegisterQueries'
import { useRegisterLogQuery } from '@/clients/admin/useRegisterQueries'

import { formatDay } from './helpers'

const FIELD_LABEL: Record<string, string> = {
  status: 'Status',
  holder: 'Verkäufer',
  heldSince: 'seit',
  releasedAt: 'freigegeben am',
  permanentNumberNumber: 'Nummer',
  sellerNumberVariation: 'Variation',
  holderFirstName: 'Vorname',
  holderLastName: 'Nachname',
  holderEmail: 'E-Mail',
  holderPhone: 'Telefon',
  holderContactChannel: 'Kontaktkanal',
  isStaff: 'Mitarbeiter',
  holderNote: 'Notiz',
  holderAliases: 'Schreibweisen',
  reviewDecision: 'Review',
  reviewDecisionMarket: 'Review-Stand',
  reviewNote: 'Review-Notiz',
}

const formatWhen = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : iso
}

/** What changed on this number and on its holder, newest first — registerLog, written by the
 *  request hooks for every edit by a person. */
export function HistoryList({
  number,
  holders,
}: {
  number: PermanentNumber
  holders: Holder[]
}) {
  const { data, isLoading } = useRegisterLogQuery([number.id, number.holder])
  const show = (field: string, value: unknown) => {
    if (value === '' || value === null || value === undefined) return '—'
    if (typeof value === 'boolean') return value ? 'ja' : 'nein'
    if (field === 'reviewDecision') return value === 'ok' ? 'OK bestätigt' : '—'
    const text = typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)
    if (field === 'holderAliases') {
      try {
        const list = JSON.parse(text) as { firstName?: string; lastName?: string }[]
        return list.map((a) => `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || '(Hash)').join(', ') || '—'
      } catch {
        return text
      }
    }
    if (field === 'holder') {
      const h = holders.find((x) => x.id === text)
      return h ? `${h.holderFirstName} ${h.holderLastName}` : text
    }
    if (field === 'heldSince' || field === 'releasedAt') return formatDay(text) || '—'
    return text
  }

  if (isLoading) return <p className="text-muted-foreground text-xs">Lade Verlauf…</p>
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-xs">Noch keine Änderungen protokolliert.</p>
  }
  return (
    <ul className="space-y-1 text-xs">
      {data.map((entry) => (
        <li key={entry.id} className="flex flex-wrap gap-x-2">
          <span className="text-muted-foreground tabular-nums">{formatWhen(entry.created)}</span>
          <span>{entry.actor || 'unbekannt'}</span>
          <span className="text-muted-foreground">
            {entry.action === 'create' ? 'angelegt' : entry.action === 'delete' ? 'gelöscht' : 'geändert'}
            {entry.targetCollection === 'permanentNumberHolders' ? ` (${entry.recordLabel})` : ''}
          </span>
          {entry.action === 'update' &&
            Object.entries(entry.changes ?? {}).map(([field, change]) => (
              <span key={field}>
                {FIELD_LABEL[field] ?? field}: {show(field, change.from)} → {show(field, change.to)}
              </span>
            ))}
        </li>
      ))}
    </ul>
  )
}

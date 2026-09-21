import type {
  Event,
  PermanentNumber,
  SellerNumber,
  Variation,
} from '@/clients/admin/useRegisterQueries'
import {
  resolveNumbers,
  useEventSellerNumbersQuery,
  usePoolsQuery,
  useSellerHistoryQuery,
} from '@/clients/admin/useRegisterQueries'
import {
  useReleaseSellerNumberMutation,
  useUpdateSellerDetailsMutation,
  type SellerDetailsInput,
} from '@/clients/admin/useRegisterMutations'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { toast } from 'sonner'

import { Field, Select } from './fields'
import { euro } from './figures'
import { describeRange, formatDay, gapsBetween } from './helpers'
import { useEditRowKeys } from './useEditRowKeys'

type Row = {
  number: number
  variationName: string
  /** The register's pool: only "Dauernummern in Event kopieren" writes into it. */
  poolPermanent: boolean
  /** Nobody can book from the pool any more (obtainableTo passed). */
  poolClosed: boolean
  sellerNumber?: SellerNumber
  registerNumber?: PermanentNumber
}

const fmtWhen = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : formatDay(iso)
}

/** Every number of one event — free, held or registered — with the registration editable
 *  and a number releasable. The Dauernummern show their register row alongside. */
export function EventNumbers({
  events,
  variations,
  registerNumbers,
  registerTerm,
  initialEventId,
  initialFilter,
}: {
  events: Event[]
  variations: Variation[]
  registerNumbers: PermanentNumber[]
  /** What the category calls a register number — "Dauernummer" or "Mitarbeiternummer". */
  registerTerm: string
  /** Opened from elsewhere (a candidate in the Marktzahlen): start on this event and number. */
  initialEventId?: string
  initialFilter?: string
}) {
  const upcoming = events.filter((e) => e.eventDate >= new Date().toISOString().slice(0, 10))
  const [eventId, setEventId] = useState(
    initialEventId ?? (upcoming.length > 0 ? upcoming[upcoming.length - 1].id : (events[0]?.id ?? ''))
  )
  const [filter, setFilter] = useState(initialFilter ?? '')
  const [onlyTaken, setOnlyTaken] = useState(true)
  const history = useSellerHistoryQuery(eventId)
  const historyByNumber = new Map((history.data?.sellers ?? []).map((s) => [s.number, s]))
  const [editingId, setEditingId] = useState<string | null>(null)
  const pools = usePoolsQuery(eventId)
  const poolIds = (pools.data ?? []).map((p) => p.id)
  const sellerNumbers = useEventSellerNumbersQuery(poolIds)

  if (!eventId) return <p className="text-muted-foreground text-sm">Kein Event in dieser Kategorie.</p>
  if (!pools.data || (poolIds.length > 0 && !sellerNumbers.data)) {
    return <Skeleton className="h-40 w-full" />
  }

  const variationName = (id: string) =>
    variations.find((v) => v.id === id)?.sellerNumberVariationName ?? '?'
  const today = new Date().toISOString().slice(0, 10)
  // A market that has happened is history: the figures went to the register, the Kasse
  // imported the file — nothing here may change it any more.
  const selectedEvent = events.find((e) => e.id === eventId)
  const isPast = selectedEvent !== undefined && selectedEvent.eventDate.slice(0, 10) < today
  const registerByKey = new Map(
    registerNumbers.map((n) => [`${n.sellerNumberVariation}:${String(n.permanentNumberNumber)}`, n])
  )

  // Numbers come from the pools; a sellerNumbers row attaches to its (pool, number).
  const takenByKey = new Map(
    (sellerNumbers.data ?? []).map((s) => [`${s.sellerNumberPool}:${String(s.sellerNumberNumber)}`, s])
  )
  const rows: Row[] = []
  for (const pool of pools.data) {
    const closed = pool.obtainableTo !== '' && pool.obtainableTo.slice(0, 10) < today
    for (const number of resolveNumbers(pool.numbersAsJsonArray)) {
      rows.push({
        number,
        variationName: variationName(pool.sellerNumberVariation),
        poolPermanent: pool.isPermanentPool,
        poolClosed: closed,
        sellerNumber: takenByKey.get(`${pool.id}:${String(number)}`),
        registerNumber: registerByKey.get(`${pool.sellerNumberVariation}:${String(number)}`),
      })
    }
  }
  rows.sort((a, b) => a.number - b.number || a.variationName.localeCompare(b.variationName))
  // Gaps between the numbers of this event, shown as their own row so nobody wonders where
  // 34, 36, 38 … went. Only while the list is unfiltered — a search result has gaps of its own.
  const gapSet = new Set(gapsBetween(rows.map((r) => r.number)))

  const needle = filter.trim().toLowerCase()
  // Digits mean a number, and a number matches whole — "12" is Nr. 12, not 112 or 120.
  // Anything else searches name and e-mail of this event's registrations only.
  const numberNeedle = /^\d+$/.test(needle) ? Number(needle) : null
  const visible = rows.filter((r) => {
    if (onlyTaken && !r.sellerNumber) return false
    if (!needle) return true
    if (numberNeedle !== null) return r.number === numberNeedle
    const d = r.sellerNumber?.expand?.sellerDetails
    return (
      `${d?.sellerFirstName ?? ''} ${d?.sellerLastName ?? ''}`.toLowerCase().includes(needle) ||
      (d?.sellerEmail ?? '').toLowerCase().includes(needle)
    )
  })
  const registered = rows.filter((r) => r.sellerNumber?.sellerDetails).length
  const held = rows.filter((r) => r.sellerNumber && !r.sellerNumber.sellerDetails).length
  // A number nobody holds in the register's pool is not free — it is reserved range without
  // a holder. A free number in a public pool whose window has ended is still free, just no
  // longer bookable.
  const unbookable = rows.filter((r) => !r.sellerNumber && r.poolPermanent).length
  const free = rows.length - registered - held - unbookable


  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Event" className="min-w-64">
          <Select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value)
              setEditingId(null)
            }}
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.eventName} — {formatDay(e.eventDate)}
              </option>
            ))}
          </Select>
        </Field>
        <Input
          placeholder="Nummer (genau), Name oder E-Mail…"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
          }}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={onlyTaken}
            onChange={(e) => {
              setOnlyTaken(e.target.checked)
            }}
          />
          nur belegte
        </label>
        <span className="text-muted-foreground pb-2 text-sm">
          {String(rows.length)} Nummern · {String(registered)} registriert · {String(held)} nur reserviert ·{' '}
          {String(free)} frei
          {unbookable > 0 && <> · {String(unbookable)} {registerTerm}n unbesetzt</>}
        </span>
      </div>
      {isPast && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
          Vergangenes Event — nur ansehen. Was an der Kasse war, bleibt so; Korrekturen gehören ins Register.
        </p>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Nr.</TableHead>
              <TableHead>Variation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead>Kennzeichen</TableHead>
              <TableHead>dabei seit</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r, index) => {
              const s = r.sellerNumber
              const d = s?.expand?.sellerDetails
              const key = `${r.variationName}:${String(r.number)}`
              const isEditing = editingId === key
              const previous = index > 0 ? visible[index - 1].number : null
              const skipped: number[] = []
              if (!needle && !onlyTaken && previous !== null) {
                for (let n = previous + 1; n < r.number; n++) if (gapSet.has(n)) skipped.push(n)
              }
              return (
                <RowGroup key={key}>
                  {skipped.length > 0 && (
                    <TableRow className="bg-slate-50/60">
                      <TableCell colSpan={8} className="text-muted-foreground py-1 text-xs italic whitespace-normal">
                        ausgelassen: {describeRange(skipped)} — Kleidergrößen und die Spendennummer werden nicht als Verkaufsnummer vergeben
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className={isEditing ? 'bg-slate-50' : undefined}>
                    <TableCell className="font-mono font-semibold">{r.number}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {r.variationName}
                      {r.poolPermanent && <span className="ml-1" title={`${registerTerm}n-Pool`}>🔒</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {!s ? (
                        r.poolPermanent ? (
                          <span className="text-muted-foreground" title={`${registerTerm} ohne Halter:in — im ${registerTerm}n-Pool, niemand kann sie buchen`}>
                            {registerTerm} unbesetzt
                          </span>
                        ) : r.poolClosed ? (
                          <span className="text-muted-foreground" title="Anmeldephase beendet, niemand kann sie mehr buchen">
                            frei · Anmeldung beendet
                          </span>
                        ) : (
                          <span className="text-muted-foreground">frei</span>
                        )
                      ) : d ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                          registriert
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          reserviert {fmtWhen(s.reservedAt)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{d ? `${d.sellerLastName}, ${d.sellerFirstName}` : ''}</TableCell>
                    <TableCell className="text-sm">
                      {d && (
                        <span title={[d.sellerEmail, d.sellerPhone].filter(Boolean).join(' · ') || undefined}>
                          {[d.sellerEmail && 'E-Mail', d.sellerPhone && 'Telefon'].filter(Boolean).join(' + ') || (
                            <span className="text-muted-foreground">keine Angabe</span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d?.isStaff && (
                        <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">MA</span>
                      )}
                      {d?.permanentNumberHolder && (
                        <span className="mr-1 rounded bg-sky-100 px-1.5 py-0.5 text-sky-800" title="vom Register materialisiert">
                          DN
                        </span>
                      )}
                      {r.registerNumber && !d?.permanentNumberHolder && (
                        <span
                          className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700"
                          title={`im Register (${r.registerNumber.status}), im Event aber nicht vom Register belegt`}
                        >
                          Register: {r.registerNumber.status}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d && (() => {
                        const hst = historyByNumber.get(r.number)
                        if (!history.data) return <span className="text-muted-foreground">…</span>
                        if (!hst || hst.markets === 0) {
                          return (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800" title="dieser Name kommt in keinem früheren Markt der Kategorie vor">
                              neu dabei
                            </span>
                          )
                        }
                        return (
                          <span className="group relative inline-block">
                            <span className="cursor-help underline decoration-dotted" tabIndex={0}>
                              {hst.firstMarket} · {String(hst.markets)}×
                            </span>
                            <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden min-w-max rounded-md border bg-white p-2 text-xs shadow-md group-hover:block group-focus-within:block">
                              <span className="text-muted-foreground mb-1 block">
                                {hst.markets > hst.recent.length ? `die letzten ${String(hst.recent.length)} von ${String(hst.markets)} Märkten` : `${String(hst.markets)} frühere Märkte`}
                              </span>
                              {hst.recent.map((m) => (
                                <span key={m.market} className="block tabular-nums whitespace-nowrap">
                                  <span className="font-mono">{m.market}</span> · Nr. <span className="font-mono">{String(m.number)}</span> · {String(m.itemsSold)} Teile, {euro(m.revenueCents)}
                                </span>
                              ))}
                            </span>
                          </span>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      {s && !isPast && (
                        <Button
                          size="sm"
                          variant={isEditing ? 'secondary' : 'outline'}
                          onClick={() => {
                            setEditingId(isEditing ? null : key)
                          }}
                        >
                          {isEditing ? 'Schließen' : 'Bearbeiten'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {isEditing && s && !isPast && (
                    <TableRow className="bg-slate-50">
                      <TableCell colSpan={8} className="whitespace-normal">
                        <EditRegistration
                          row={r}
                          sellerNumber={s}
                          onDone={() => {
                            setEditingId(null)
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </RowGroup>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}


function EditRegistration({
  row,
  sellerNumber,
  onDone,
}: {
  row: Row
  sellerNumber: SellerNumber
  onDone: () => void
}) {
  const d = sellerNumber.expand?.sellerDetails
  const [input, setInput] = useState<SellerDetailsInput>({
    sellerFirstName: d?.sellerFirstName ?? '',
    sellerLastName: d?.sellerLastName ?? '',
    sellerEmail: d?.sellerEmail ?? '',
    sellerPhone: d?.sellerPhone ?? '',
    isStaff: d?.isStaff ?? false,
  })
  const update = useUpdateSellerDetailsMutation()
  const release = useReleaseSellerNumberMutation()
  const busy = update.isPending || release.isPending
  const set = <K extends keyof SellerDetailsInput>(key: K, v: SellerDetailsInput[K]) => {
    setInput({ ...input, [key]: v })
  }

  const save = async () => {
    if (!d) return
    await update.mutateAsync({ id: d.id, data: input })
    toast.success(`Nr. ${String(row.number)}: Registrierung gespeichert`)
  }
  const free = async () => {
    await release.mutateAsync({ sellerNumberId: sellerNumber.id, sellerDetailsId: sellerNumber.sellerDetails })
    toast.success(`Nr. ${String(row.number)} ist wieder frei`)
    onDone()
  }

  const keys = useEditRowKeys(onDone)

  return (
    <div className="space-y-4 py-2" ref={keys.ref} onKeyDown={keys.onKeyDown}>
      {d ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <h4 className="text-sm font-semibold">Registrierung bearbeiten</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Vorname">
              <Input value={input.sellerFirstName} onChange={(e) => { set('sellerFirstName', e.target.value); }} disabled={busy} required />
            </Field>
            <Field label="Nachname">
              <Input value={input.sellerLastName} onChange={(e) => { set('sellerLastName', e.target.value); }} disabled={busy} required />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" checked={input.isStaff} onChange={(e) => { set('isStaff', e.target.checked); }} disabled={busy} />
              Mitarbeiter:in (<code>ma</code> im Export)
            </label>
            <Field label="E-Mail">
              <Input type="email" value={input.sellerEmail} onChange={(e) => { set('sellerEmail', e.target.value); }} disabled={busy} />
            </Field>
            <Field label="Telefon">
              <Input value={input.sellerPhone} onChange={(e) => { set('sellerPhone', e.target.value); }} disabled={busy} />
            </Field>
          </div>
          <p className="text-muted-foreground text-xs">
            Gilt nur für dieses Event. {d.permanentNumberHolder
              ? 'Die Nummer ist vom Register materialisiert — das nächste „Materialisieren" schreibt die Registerdaten wieder darüber; dauerhafte Änderungen gehören ins Register.'
              : 'Registriert ' + fmtWhen(d.created) + '.'}
          </p>
          <Button type="submit" size="sm" disabled={busy}>
            Registrierung speichern
          </Button>
          <span className="text-muted-foreground ml-3 text-xs">Enter speichert, Esc schließt ohne Speichern</span>
        </form>
      ) : (
        <p className="text-sm">
          Reservierung ohne Registrierung seit {fmtWhen(sellerNumber.reservedAt)} — läuft von selbst ab oder wird hier freigegeben.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={busy}>
              Nummer freigeben
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Nr. {String(row.number)} freigeben?</AlertDialogTitle>
              <AlertDialogDescription>
                Die Reservierung und die Registrierung werden gelöscht; die Nummer ist danach wieder frei.
                {d?.permanentNumberHolder && ' Sie ist vom Register materialisiert und kommt beim nächsten „Materialisieren" zurück, solange ihre Register-Zeile aktiv ist.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => void free()}>Freigeben</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <span className="text-muted-foreground text-xs">Wird im Verlauf protokolliert.</span>
      </div>
    </div>
  )
}

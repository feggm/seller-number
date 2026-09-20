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
import { formatDay } from './helpers'

type Row = {
  number: number
  variationName: string
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
}: {
  events: Event[]
  variations: Variation[]
  registerNumbers: PermanentNumber[]
}) {
  const upcoming = events.filter((e) => e.eventDate >= new Date().toISOString().slice(0, 10))
  const [eventId, setEventId] = useState(
    upcoming.length > 0 ? upcoming[upcoming.length - 1].id : (events[0]?.id ?? '')
  )
  const [filter, setFilter] = useState('')
  const [onlyTaken, setOnlyTaken] = useState(true)
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
        poolClosed: closed,
        sellerNumber: takenByKey.get(`${pool.id}:${String(number)}`),
        registerNumber: registerByKey.get(`${pool.sellerNumberVariation}:${String(number)}`),
      })
    }
  }
  rows.sort((a, b) => a.number - b.number || a.variationName.localeCompare(b.variationName))

  const needle = filter.trim().toLowerCase()
  const visible = rows.filter((r) => {
    if (onlyTaken && !r.sellerNumber) return false
    if (!needle) return true
    const d = r.sellerNumber?.expand?.sellerDetails
    return (
      String(r.number).includes(needle) ||
      `${d?.sellerFirstName ?? ''} ${d?.sellerLastName ?? ''}`.toLowerCase().includes(needle) ||
      (d?.sellerEmail ?? '').toLowerCase().includes(needle)
    )
  })
  const registered = rows.filter((r) => r.sellerNumber?.sellerDetails).length
  const held = rows.filter((r) => r.sellerNumber && !r.sellerNumber.sellerDetails).length

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
          placeholder="Nummer, Name oder E-Mail suchen…"
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
          {String(rows.length - registered - held)} frei
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
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => {
              const s = r.sellerNumber
              const d = s?.expand?.sellerDetails
              const key = `${r.variationName}:${String(r.number)}`
              const isEditing = editingId === key
              return (
                <RowGroup key={key}>
                  <TableRow className={isEditing ? 'bg-slate-50' : undefined}>
                    <TableCell className="font-mono font-semibold">{r.number}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {r.variationName}
                      {r.poolClosed && <span className="ml-1" title="geschlossener Pool">🔒</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {!s ? (
                        <span className="text-muted-foreground">frei</span>
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
                        <div className="flex flex-col">
                          <span>{d.sellerEmail || '—'}</span>
                          {d.sellerPhone && <span className="text-muted-foreground text-xs">{d.sellerPhone}</span>}
                        </div>
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
                      <TableCell colSpan={7} className="whitespace-normal">
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

  return (
    <div className="space-y-4 py-2">
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

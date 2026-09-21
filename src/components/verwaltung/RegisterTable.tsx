import type {
  Holder,
  MarketStats,
  NumberMarket,
  NumberStatus,
  PermanentNumber,
  Variation,
} from '@/clients/admin/useRegisterQueries'
import {
  useCreateHolderMutation,
  useUpdateHolderMutation,
  useUpdateNumberMutation,
} from '@/clients/admin/useRegisterMutations'
import type { HolderInput } from '@/clients/admin/useRegisterMutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

import { Field, HolderFields, Select } from './fields'
import { HistoryList } from './HistoryList'
import { MarketFigures, euro, windowOf } from './MarketFigures'
import { emptyHolderInput, formatDay, holderToInput, holderWarning, toDayInput } from './helpers'

const STATUS_LABEL: Record<NumberStatus, string> = {
  aktiv: 'aktiv',
  pausiert: 'pausiert',
  freigegeben: 'freigegeben',
  gesperrt: 'gesperrt',
}

const STATUS_CLASS: Record<NumberStatus, string> = {
  aktiv: 'bg-emerald-100 text-emerald-800',
  pausiert: 'bg-amber-100 text-amber-800',
  freigegeben: 'bg-slate-200 text-slate-700',
  gesperrt: 'bg-red-100 text-red-800',
}

export function RegisterTable({
  numbers,
  variations,
  holders,
  markets,
  stats,
}: {
  numbers: PermanentNumber[]
  variations: Variation[]
  holders: Holder[]
  markets: NumberMarket[]
  stats: MarketStats[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const statsByMarket = new Map(stats.map((s) => [s.market, s]))
  const variationName = (id: string) =>
    variations.find((v) => v.id === id)?.sellerNumberVariationName ?? '?'

  const needle = filter.trim().toLowerCase()
  const visible = numbers.filter((n) => {
    if (onlyFlagged && !n.reviewFlag) return false
    if (!needle) return true
    const h = n.expand?.holder
    return (
      String(n.permanentNumberNumber).includes(needle) ||
      `${h?.holderFirstName ?? ''} ${h?.holderLastName ?? ''}`.toLowerCase().includes(needle) ||
      (h?.holderEmail ?? '').toLowerCase().includes(needle)
    )
  })
  const flaggedCount = numbers.filter((n) => n.reviewFlag).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Nummer, Name oder E-Mail suchen…"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); }}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyFlagged} onChange={(e) => { setOnlyFlagged(e.target.checked); }} />
          nur mit Review-Flag ({String(flaggedCount)})
        </label>
        <span className="text-muted-foreground text-sm">
          {visible.length} von {numbers.length} Nummern
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Nr.</TableHead>
              <TableHead>Variation</TableHead>
              <TableHead>Halter:in</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>seit</TableHead>
              <TableHead>Ø letzte 4</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((n) => {
              const h = n.expand?.holder
              const warning = h ? holderWarning(h) : null
              const isEditing = editingId === n.id
              return (
                <RowGroup key={n.id}>
                  <TableRow className={isEditing ? 'bg-slate-50' : undefined}>
                    <TableCell className="font-mono font-semibold">
                      {n.permanentNumberNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {variationName(n.sellerNumberVariation)}
                    </TableCell>
                    <TableCell>
                      {h ? (
                        <>
                          {h.holderLastName}, {h.holderFirstName}
                          {h.isStaff && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                              MA
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-red-700">Halter:in fehlt</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {h && (
                        <div className="flex flex-col">
                          <span>{h.holderEmail || h.holderPhone || '—'}</span>
                          {warning && (
                            <span
                              className={
                                warning.level === 'error'
                                  ? 'text-xs text-red-700'
                                  : 'text-xs text-amber-700'
                              }
                            >
                              ⚠ {warning.text}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${STATUS_CLASS[n.status]}`}
                      >
                        {STATUS_LABEL[n.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{formatDay(n.heldSince) || '—'}</TableCell>
                    <TableCell className="text-xs">
                      <WindowCell number={n} markets={markets} statsByMarket={statsByMarket} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={isEditing ? 'secondary' : 'outline'}
                        onClick={() => { setEditingId(isEditing ? null : n.id); }}
                      >
                        {isEditing ? 'Schließen' : 'Bearbeiten'}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isEditing && h && (
                    <TableRow className="bg-slate-50">
                      <TableCell colSpan={8} className="whitespace-normal">
                        <EditRow
                          number={n}
                          holder={h}
                          holders={holders}
                          markets={markets}
                          statsByMarket={statsByMarket}
                          onDone={() => { setEditingId(null); }}
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

/** Two table rows as one React child without an extra DOM element. */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/** The window in one glance: means over the last four holder markets, and the flag. */
function WindowCell({
  number,
  markets,
  statsByMarket,
}: {
  number: PermanentNumber
  markets: NumberMarket[]
  statsByMarket: Map<string, MarketStats>
}) {
  const w = windowOf(number, markets, statsByMarket)
  if (w.own.length === 0) return <span className="text-muted-foreground">—</span>
  const items = w.itemsMean === null ? '—' : w.itemsMean.toFixed(1).replace('.', ',')
  return (
    <span className="flex flex-col">
      <span className="tabular-nums">
        {items} Teile · {euro(w.revenueMean === null ? null : Math.round(w.revenueMean))}
        {!w.complete && <span className="text-muted-foreground"> ({String(w.window.length)}/4)</span>}
      </span>
      {number.reviewFlag && (
        <span className="w-fit rounded bg-red-100 px-1.5 py-0.5 text-red-800" title="beide Mittel unter dem Median der letzten vier Märkte">
          Review
        </span>
      )}
    </span>
  )
}

function EditRow({
  number,
  holder,
  holders,
  markets,
  statsByMarket,
  onDone,
}: {
  number: PermanentNumber
  holder: Holder
  holders: Holder[]
  markets: NumberMarket[]
  statsByMarket: Map<string, MarketStats>
  onDone: () => void
}) {
  const [holderInput, setHolderInput] = useState<HolderInput>(holderToInput(holder))
  const [status, setStatus] = useState<NumberStatus>(number.status)
  const [heldSince, setHeldSince] = useState(toDayInput(number.heldSince))
  const [rehomeMode, setRehomeMode] = useState<'existing' | 'new'>('existing')
  const [newHolderId, setNewHolderId] = useState('')
  const [newHolder, setNewHolder] = useState<HolderInput>(emptyHolderInput())
  const updateHolder = useUpdateHolderMutation()
  const updateNumber = useUpdateNumberMutation()
  const createHolder = useCreateHolderMutation()
  const busy = updateHolder.isPending || updateNumber.isPending || createHolder.isPending

  const saveHolder = async () => {
    await updateHolder.mutateAsync({ id: holder.id, data: holderInput })
    toast.success(`Halter:in von Nr. ${String(number.permanentNumberNumber)} gespeichert`)
  }

  const saveNumber = async () => {
    await updateNumber.mutateAsync({
      id: number.id,
      data: { status, heldSince },
    })
    toast.success(`Nr. ${String(number.permanentNumberNumber)}: Status ${status}`)
  }

  const rehome = async (holderId: string, name?: string) => {
    if (!holderId) return
    const target = name ?? holders.find((x) => x.id === holderId)
    const label =
      typeof target === 'string'
        ? target
        : `${target?.holderFirstName ?? ''} ${target?.holderLastName ?? ''}`.trim()
    await updateNumber.mutateAsync({ id: number.id, data: { holder: holderId } })
    toast.success(`Nr. ${String(number.permanentNumberNumber)} gehört jetzt ${label}`)
    onDone()
  }

  const rehomeToNew = async () => {
    const created = await createHolder.mutateAsync(newHolder)
    await rehome(created.id, `${created.holderFirstName} ${created.holderLastName}`)
  }

  return (
    <div className="space-y-4 py-2">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void saveHolder()
        }}
      >
        <h4 className="text-sm font-semibold">Halter:in bearbeiten</h4>
        <HolderFields value={holderInput} onChange={setHolderInput} disabled={busy} />
        <p className="text-muted-foreground text-xs">
          Gilt für alle Nummern dieser Person. Eine bereits materialisierte Nummer zieht die
          Änderung beim nächsten „Materialisieren" nach.
        </p>
        <Button type="submit" size="sm" disabled={busy}>
          Halter:in speichern
        </Button>
      </form>

      <div className="grid grid-cols-1 gap-3 border-t pt-3 md:grid-cols-[1fr_1fr_auto]">
        <Field label="Status">
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value as NumberStatus); }}
            disabled={busy}
          >
            {(Object.keys(STATUS_LABEL) as NumberStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dauernummer seit">
          <Input
            type="date"
            value={heldSince}
            onChange={(e) => { setHeldSince(e.target.value); }}
            disabled={busy}
          />
        </Field>
        <div className="self-end">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void saveNumber()}>
            Nummer speichern
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        <code>pausiert</code>/<code>freigegeben</code>/<code>gesperrt</code> nimmt die Nummer
        aus der nächsten Materialisierung; eine schon reservierte Nummer bleibt im Event und
        wird dort als <code>stale</code> gemeldet.
      </p>

      <div className="space-y-2 border-t pt-3">
        <h4 className="text-sm font-semibold">Marktzahlen</h4>
        <MarketFigures number={number} rows={markets} statsByMarket={statsByMarket} />
      </div>

      <div className="space-y-2 border-t pt-3">
        <h4 className="text-sm font-semibold">Verlauf</h4>
        <HistoryList number={number} holders={holders} />
      </div>

      <div className="space-y-3 border-t pt-3">
        <h4 className="text-sm font-semibold">Nummer an eine andere Person geben</h4>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={rehomeMode === 'existing'}
              onChange={() => { setRehomeMode('existing'); }}
              disabled={busy}
            />
            bereits erfasste Person
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={rehomeMode === 'new'}
              onChange={() => { setRehomeMode('new'); }}
              disabled={busy}
            />
            neue Person
          </label>
        </div>
        {rehomeMode === 'existing' ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <Field label="Person">
              <Select
                value={newHolderId}
                onChange={(e) => { setNewHolderId(e.target.value); }}
                disabled={busy}
              >
                <option value="">— Person wählen —</option>
                {holders
                  .filter((x) => x.id !== holder.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.holderLastName}, {x.holderFirstName}
                      {x.holderEmail ? ` · ${x.holderEmail}` : x.holderPhone ? ` · ${x.holderPhone}` : ''}
                    </option>
                  ))}
              </Select>
            </Field>
            <div className="self-end">
              <Button
                size="sm"
                variant="destructive"
                disabled={busy || !newHolderId}
                onClick={() => void rehome(newHolderId)}
              >
                Halter:in wechseln
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void rehomeToNew()
            }}
          >
            <HolderFields value={newHolder} onChange={setNewHolder} disabled={busy} />
            <Button type="submit" size="sm" variant="destructive" disabled={busy}>
              Person anlegen und Nummer übergeben
            </Button>
          </form>
        )}
        <p className="text-muted-foreground text-xs">
          Die bisherige Person bleibt erfasst; ihre alten Marktzahlen bleiben bei ihr, die neue
          beginnt bei null (Hash-Segmentierung, §1.10). Eine schon materialisierte Nummer wird
          beim nächsten „Materialisieren" auf die neue Person umgeschrieben.
        </p>
      </div>
    </div>
  )
}

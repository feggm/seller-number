import type { Event, Holder, NumberStatus, Variation } from '@/clients/admin/useRegisterQueries'
import { resolveNumbers, usePoolsQuery } from '@/clients/admin/useRegisterQueries'
import { useCreateNumberMutation } from '@/clients/admin/useRegisterMutations'
import type { HolderInput } from '@/clients/admin/useRegisterMutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { toast } from 'sonner'

import { Field, HolderFields, Select } from './fields'
import { emptyHolderInput, formatDay } from './helpers'

/** A new Dauernummer: number + variation, held by an existing person or a new one. The
 *  unique index (variation, number) refuses a duplicate — the toast then says so. */
export function NewNumberForm({
  variations,
  holders,
  events,
  defaultVariationId,
  registerTerm,
}: {
  variations: Variation[]
  holders: Holder[]
  events: Event[]
  defaultVariationId: string
  registerTerm: string
}) {
  const [number, setNumber] = useState('')
  const [variationId, setVariationId] = useState(defaultVariationId)
  const [heldSince, setHeldSince] = useState('')
  const [status, setStatus] = useState<NumberStatus>('aktiv')
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [holderId, setHolderId] = useState('')
  const [newHolder, setNewHolder] = useState<HolderInput>(emptyHolderInput())
  const create = useCreateNumberMutation()

  // A Verkaufsnummer only exists inside a pool. The next event's pools say which numbers the
  // category has at all — and whether the number sits in the public range, where it would be
  // handed out to anyone before it gets materialised.
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter((e) => e.eventDate.slice(0, 10) >= today)
  const referenceEvent: Event | undefined = upcoming.length > 0 ? upcoming[upcoming.length - 1] : events.at(0)
  const pools = usePoolsQuery(referenceEvent?.id ?? '')
  const chosenVariation = variationId || defaultVariationId
  const parsed = Number(number)
  const numberValid = number.trim() !== '' && Number.isInteger(parsed) && parsed > 0
  const poolsOfVariation = (pools.data ?? []).filter((p) => p.sellerNumberVariation === chosenVariation)
  const containing = numberValid
    ? poolsOfVariation.filter((p) => resolveNumbers(p.numbersAsJsonArray).includes(parsed))
    : []
  const inPublicPool = containing.some((p) => !p.isPermanentPool)
  const poolCheck: { ok: boolean; text: string; level: 'ok' | 'warn' | 'error' } | null = !numberValid
    ? null
    : !referenceEvent || !pools.data
      ? null
      : containing.length === 0
        ? { ok: false, level: 'error', text: `Nr. ${String(parsed)} liegt in keinem Pool von „${referenceEvent.eventName}" (${formatDay(referenceEvent.eventDate)}) — erst den Pool anlegen oder erweitern.` }
        : inPublicPool
          ? { ok: true, level: 'warn', text: `Nr. ${String(parsed)} liegt im Publikums-Pool: vor dem Kopieren in den ${registerTerm}n-Pool umziehen, sonst geht sie an einen normalen Verkäufer.` }
          : { ok: true, level: 'ok', text: `Nr. ${String(parsed)} liegt im ${registerTerm}n-Pool von „${referenceEvent.eventName}".` }

  const submit = async () => {
    const n = Number(number)
    if (!Number.isInteger(n) || n <= 0) {
      toast.error('Verkaufsnummer muss eine positive ganze Zahl sein')
      return
    }
    if (poolCheck && !poolCheck.ok) {
      toast.error(poolCheck.text)
      return
    }
    const created = await create.mutateAsync({
      sellerNumberVariation: variationId || defaultVariationId,
      permanentNumberNumber: n,
      heldSince,
      status,
      holderId: mode === 'existing' ? holderId : undefined,
      newHolder: mode === 'new' ? newHolder : undefined,
    })
    toast.success(`Nr. ${String(created.permanentNumberNumber)} angelegt`)
    setNumber('')
    setHeldSince('')
    setHolderId('')
    setNewHolder(emptyHolderInput())
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Verkaufsnummer">
          <Input
            inputMode="numeric"
            value={number}
            onChange={(e) => { setNumber(e.target.value); }}
            aria-invalid={poolCheck ? !poolCheck.ok : undefined}
            required
          />
        </Field>
        <Field label="Variation">
          <Select value={variationId || defaultVariationId} onChange={(e) => { setVariationId(e.target.value); }}>
            {variations.map((v) => (
              <option key={v.id} value={v.id}>
                {v.sellerNumberVariationName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dauernummer seit (optional)">
          <Input type="date" value={heldSince} onChange={(e) => { setHeldSince(e.target.value); }} />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => { setStatus(e.target.value as NumberStatus); }}>
            <option value="aktiv">aktiv — wird materialisiert</option>
            <option value="pausiert">pausiert — setzt diesen Markt aus</option>
          </Select>
        </Field>
      </div>

      {poolCheck && (
        <p
          className={
            poolCheck.level === 'error'
              ? 'text-xs text-red-700'
              : poolCheck.level === 'warn'
                ? 'text-xs text-amber-700'
                : 'text-xs text-emerald-700'
          }
        >
          {poolCheck.text}
        </p>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === 'new'} onChange={() => { setMode('new'); }} />
          neue Person
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === 'existing'} onChange={() => { setMode('existing'); }} />
          bereits erfasste Person (zweite Nummer)
        </label>
      </div>

      {mode === 'new' ? (
        <HolderFields value={newHolder} onChange={setNewHolder} disabled={create.isPending} />
      ) : (
        <Field label="Person">
          <Select value={holderId} onChange={(e) => { setHolderId(e.target.value); }} required>
            <option value="">— Person wählen —</option>
            {holders.map((x) => (
              <option key={x.id} value={x.id}>
                {x.holderLastName}, {x.holderFirstName}
                {x.holderEmail ? ` · ${x.holderEmail}` : x.holderPhone ? ` · ${x.holderPhone}` : ''}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Button
        type="submit"
        disabled={create.isPending || (mode === 'existing' && !holderId) || (poolCheck !== null && !poolCheck.ok)}
      >
        Dauernummer anlegen
      </Button>
    </form>
  )
}

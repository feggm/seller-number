import type { Holder, NumberStatus, Variation } from '@/clients/admin/useRegisterQueries'
import { useCreateNumberMutation } from '@/clients/admin/useRegisterMutations'
import type { HolderInput } from '@/clients/admin/useRegisterMutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { toast } from 'sonner'

import { Field, HolderFields, Select } from './fields'
import { emptyHolderInput } from './helpers'

/** A new Dauernummer: number + variation, held by an existing person or a new one. The
 *  unique index (variation, number) refuses a duplicate — the toast then says so. */
export function NewNumberForm({
  variations,
  holders,
  defaultVariationId,
}: {
  variations: Variation[]
  holders: Holder[]
  defaultVariationId: string
}) {
  const [number, setNumber] = useState('')
  const [variationId, setVariationId] = useState(defaultVariationId)
  const [heldSince, setHeldSince] = useState('')
  const [status, setStatus] = useState<NumberStatus>('aktiv')
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [holderId, setHolderId] = useState('')
  const [newHolder, setNewHolder] = useState<HolderInput>(emptyHolderInput())
  const create = useCreateNumberMutation()

  const submit = async () => {
    const n = Number(number)
    if (!Number.isInteger(n) || n <= 0) {
      toast.error('Nummer muss eine positive ganze Zahl sein')
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
        <Field label="Nummer">
          <Input
            inputMode="numeric"
            value={number}
            onChange={(e) => { setNumber(e.target.value); }}
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

      <Button type="submit" disabled={create.isPending || (mode === 'existing' && !holderId)}>
        Nummer anlegen
      </Button>
    </form>
  )
}

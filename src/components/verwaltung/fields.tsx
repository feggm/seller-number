import type { ContactChannel } from '@/clients/admin/useRegisterQueries'
import type { HolderInput } from '@/clients/admin/useRegisterMutations'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import * as React from 'react'

/** A native select in the Input's clothes — the admin page needs no popover menu. */
export function Select({
  className,
  ...props
}: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-2 py-1 text-sm shadow-xs outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1 text-sm', className)}>
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  )
}

/** The holder's fields, one grid — used for editing and for a new person alike. */
export function HolderFields({
  value,
  onChange,
  disabled,
}: {
  value: HolderInput
  onChange: (next: HolderInput) => void
  disabled?: boolean
}) {
  const set = <K extends keyof HolderInput>(key: K, v: HolderInput[K]) =>
    { onChange({ ...value, [key]: v }); }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Field label="Vorname">
        <Input
          value={value.holderFirstName}
          onChange={(e) => { set('holderFirstName', e.target.value); }}
          disabled={disabled}
          required
        />
      </Field>
      <Field label="Nachname">
        <Input
          value={value.holderLastName}
          onChange={(e) => { set('holderLastName', e.target.value); }}
          disabled={disabled}
          required
        />
      </Field>
      <Field label="Kontaktkanal">
        <Select
          value={value.holderContactChannel}
          onChange={(e) => { set('holderContactChannel', e.target.value as ContactChannel); }}
          disabled={disabled}
        >
          <option value="email">E-Mail</option>
          <option value="whatsapp">WhatsApp (Bestätigung manuell)</option>
        </Select>
      </Field>
      <Field
        label={value.holderContactChannel === 'email' ? 'E-Mail (Pflicht)' : 'E-Mail (optional)'}
      >
        <Input
          type="email"
          value={value.holderEmail}
          onChange={(e) => { set('holderEmail', e.target.value); }}
          disabled={disabled}
          required={value.holderContactChannel === 'email'}
        />
      </Field>
      <Field label={value.holderContactChannel === 'whatsapp' ? 'Telefon (WhatsApp)' : 'Telefon'}>
        <Input
          value={value.holderPhone}
          onChange={(e) => { set('holderPhone', e.target.value); }}
          disabled={disabled}
        />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input
          type="checkbox"
          checked={value.isStaff}
          onChange={(e) => { set('isStaff', e.target.checked); }}
          disabled={disabled}
        />
        Mitarbeiter:in (<code>ma</code> im Export)
      </label>
      <Field label="Notiz" className="md:col-span-3">
        <Input
          value={value.holderNote}
          onChange={(e) => { set('holderNote', e.target.value); }}
          disabled={disabled}
        />
      </Field>
      <div className="md:col-span-3">
        <AliasFields
          value={value.holderAliases}
          onChange={(aliases) => { set('holderAliases', aliases); }}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

/** Other spellings the person sold under — nickname, maiden name, a typo in an old seed. The
 *  statistics count a market under any of them as this person's. An alias taken over from a
 *  market row carries only its hash pair and shows as such. */
function AliasFields({
  value,
  onChange,
  disabled,
}: {
  value: HolderInput['holderAliases']
  onChange: (next: HolderInput['holderAliases']) => void
  disabled?: boolean
}) {
  const [first, setFirst] = React.useState('')
  const [last, setLast] = React.useState('')
  const add = () => {
    if (!first.trim() && !last.trim()) return
    onChange([...value, { firstName: first.trim(), lastName: last.trim(), firstNameHash: '', lastNameHash: '' }])
    setFirst('')
    setLast('')
  }
  return (
    <div className="space-y-2">
      <span className="text-muted-foreground text-xs">
        Weitere Schreibweisen (Spitzname, Geburtsname, Tippfehler in alten Listen) — Märkte unter diesem
        Namen zählen als diese Person
      </span>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((a, i) => (
            <li key={`${a.firstNameHash}${a.firstName}|${a.lastNameHash}${a.lastName}`} className="flex items-center gap-1 rounded border px-2 py-0.5 text-sm">
              {a.firstName || a.lastName ? (
                <span>{a.firstName} {a.lastName}</span>
              ) : (
                <span className="text-muted-foreground" title={`${a.firstNameHash.slice(0, 8)}… / ${a.lastNameHash.slice(0, 8)}…`}>
                  aus Marktzeile übernommen
                </span>
              )}
              <button
                type="button"
                className="text-muted-foreground ml-1 hover:text-red-700"
                title="entfernen"
                disabled={disabled}
                onClick={() => { onChange(value.filter((_, j) => j !== i)); }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Vorname">
          <Input value={first} onChange={(e) => { setFirst(e.target.value); }} disabled={disabled} className="w-40" />
        </Field>
        <Field label="Nachname">
          <Input value={last} onChange={(e) => { setLast(e.target.value); }} disabled={disabled} className="w-40" />
        </Field>
        <button
          type="button"
          className="border-input h-9 rounded-md border px-3 text-sm hover:bg-slate-50 disabled:opacity-50"
          disabled={disabled === true || (!first.trim() && !last.trim())}
          onClick={add}
        >
          Schreibweise hinzufügen
        </button>
      </div>
    </div>
  )
}

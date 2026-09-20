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
    </div>
  )
}

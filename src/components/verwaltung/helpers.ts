import type { Holder } from '@/clients/admin/useRegisterQueries'
import type { HolderInput } from '@/clients/admin/useRegisterMutations'

/** What the register should warn about for a holder — mirrors holderWarning() in
 *  permanent-numbers-core.js: a WhatsApp holder gets no confirmation mail, one without a
 *  number has to be reached through the team. */
export const holderWarning = (holder: Pick<Holder, 'holderContactChannel' | 'holderPhone'>) =>
  holder.holderContactChannel !== 'whatsapp'
    ? null
    : holder.holderPhone.trim()
      ? ({ level: 'warn', text: 'WhatsApp — Bestätigung manuell' } as const)
      : ({ level: 'error', text: 'WhatsApp ohne Nummer — über das Team' } as const)

export const emptyHolderInput = (): HolderInput => ({
  holderFirstName: '',
  holderLastName: '',
  holderEmail: '',
  holderPhone: '',
  holderContactChannel: 'email',
  isStaff: false,
  holderNote: '',
})

export const holderToInput = (holder: Holder): HolderInput => ({
  holderFirstName: holder.holderFirstName,
  holderLastName: holder.holderLastName,
  holderEmail: holder.holderEmail,
  holderPhone: holder.holderPhone,
  holderContactChannel: holder.holderContactChannel,
  isStaff: holder.isStaff,
  holderNote: holder.holderNote,
})

export const formatDay = (dbDate: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dbDate)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}

export const toDayInput = (dbDate: string) => dbDate.slice(0, 10)
